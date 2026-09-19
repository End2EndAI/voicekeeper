import { AppState, AppStateStatus } from 'react-native';
import { supabase } from './supabase';
import { readDocument, writeDocument, removeDocument } from './localStore';
import { coalesce, locallyOwnedNoteIds, locallyPurgedNoteIds, MAX_ATTEMPTS } from './syncQueue';
import { isNetworkError, isOnline, subscribeToConnectivity } from '../utils/network';
import { Note, SyncOp, SyncState } from '../types';

/**
 * Synchronisation engine.
 *
 * Everything the user does is applied to the local cache first and recorded in
 * a durable outbox; this module is what eventually replays that outbox against
 * Supabase and then pulls the server's state back down. It owns no data of its
 * own — the contexts that hold the notes and tags register a "puller" and are
 * called once the outbox is empty.
 *
 * A cycle is: push the outbox (in order, stopping at the first transport
 * failure) -> run every registered puller -> publish the new state. Cycles are
 * de-duplicated, so several callers asking to sync at once share one run.
 */

const QUEUE_VERSION = 1;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;
const DEBOUNCE_MS = 400;

interface StoredQueue {
  version: number;
  ops: SyncOp[];
}

type Puller = () => Promise<void>;

let userId: string | null = null;
let queue: SyncOp[] = [];
let queueLoaded = false;

let state: SyncState = {
  syncing: false,
  offline: false,
  pending: 0,
  lastSyncAt: null,
  lastError: null,
};

const listeners = new Set<(state: SyncState) => void>();
const pullers = new Map<string, Puller>();

let inFlight: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let teardownListeners: (() => void) | null = null;
let engineRefCount = 0;

// ---------------------------------------------------------------------------
// State plumbing
// ---------------------------------------------------------------------------

function publish(patch: Partial<SyncState>): void {
  state = { ...state, ...patch, pending: queue.length };
  for (const listener of listeners) listener(state);
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeToSync(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Registers a callback invoked at the pull phase of every cycle. The notes and
 * tags contexts each register one so a single `runSync()` refreshes both.
 */
export function registerPuller(key: string, puller: Puller): () => void {
  pullers.set(key, puller);
  return () => {
    if (pullers.get(key) === puller) pullers.delete(key);
  };
}

// ---------------------------------------------------------------------------
// Outbox persistence
// ---------------------------------------------------------------------------

function queueDocumentName(id: string): string {
  return `outbox-${id}`;
}

async function persistQueue(): Promise<void> {
  if (!userId) return;
  const payload: StoredQueue = { version: QUEUE_VERSION, ops: queue };
  await writeDocument(queueDocumentName(userId), payload);
}

async function loadQueue(): Promise<void> {
  if (!userId) {
    queue = [];
    queueLoaded = true;
    return;
  }
  const stored = await readDocument<StoredQueue>(queueDocumentName(userId));
  queue = stored?.version === QUEUE_VERSION && Array.isArray(stored.ops) ? stored.ops : [];
  queueLoaded = true;
  publish({});
}

/**
 * Binds the engine to a user. Called when the session changes; passing null
 * (sign-out) stops the timers and drops the in-memory outbox — the file stays
 * on disk so pending work survives until the same user signs back in.
 */
export async function configureSync(nextUserId: string | null): Promise<void> {
  if (userId === nextUserId && queueLoaded) return;

  cancelTimers();
  userId = nextUserId;
  queueLoaded = false;
  queue = [];
  retryAttempt = 0;
  publish({ syncing: false, offline: false, lastError: null, lastSyncAt: null });

  await loadQueue();
}

/** Drops every trace of a user's outbox (account deletion). */
export async function clearSyncData(id: string): Promise<void> {
  if (userId === id) {
    queue = [];
    publish({});
  }
  await removeDocument(queueDocumentName(id));
}

// ---------------------------------------------------------------------------
// Enqueuing
// ---------------------------------------------------------------------------

/** Records a mutation and schedules a push. Never throws. */
export async function enqueue(op: SyncOp): Promise<void> {
  if (!queueLoaded) await loadQueue();
  queue = coalesce(queue, op);
  publish({});
  await persistQueue();
  scheduleSync();
}

/** Note ids whose local version must survive the next merge. */
export function pendingNoteIds(): Set<string> {
  return locallyOwnedNoteIds(queue);
}

/** Note ids deleted locally but not yet deleted on the server. */
export function purgedNoteIds(): Set<string> {
  return locallyPurgedNoteIds(queue);
}

// ---------------------------------------------------------------------------
// Pushing
// ---------------------------------------------------------------------------

/** Columns the server owns or that only exist locally. */
function noteRow(note: Note, uid: string): Record<string, unknown> {
  return {
    id: note.id,
    user_id: uid,
    title: note.title,
    formatted_text: note.formatted_text,
    raw_transcription: note.raw_transcription ?? null,
    format_type: note.format_type,
    source: note.source ?? 'voice',
    audio_uri: note.audio_uri ?? null,
    created_at: note.created_at,
    updated_at: note.updated_at,
    archived_at: note.archived_at ?? null,
    deleted_at: note.deleted_at ?? null,
  };
}

async function applyOp(op: SyncOp, uid: string): Promise<void> {
  switch (op.kind) {
    case 'note.create': {
      if (!op.note) return;
      // upsert, not insert: a retry after a lost response must not fail on the
      // primary key it already wrote
      const { error } = await supabase
        .from('notes')
        .upsert(noteRow(op.note, uid), { onConflict: 'id' });
      if (error) throw error;
      return;
    }

    case 'note.update': {
      const { error } = await supabase
        .from('notes')
        .update(op.patch ?? {})
        .eq('id', op.noteId);
      if (error) throw error;
      return;
    }

    case 'note.purge': {
      const { error } = await supabase.from('notes').delete().eq('id', op.noteId);
      if (error) throw error;
      return;
    }

    case 'noteTag.add': {
      if (!op.tagId) return;
      const { error } = await supabase
        .from('note_tags')
        .upsert(
          { note_id: op.noteId, tag_id: op.tagId },
          { onConflict: 'note_id,tag_id', ignoreDuplicates: true }
        );
      if (error) throw error;
      return;
    }

    case 'noteTag.remove': {
      if (!op.tagId) return;
      const { error } = await supabase
        .from('note_tags')
        .delete()
        .eq('note_id', op.noteId)
        .eq('tag_id', op.tagId);
      if (error) throw error;
      return;
    }
  }
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Replays the outbox head-first, so ordering dependencies (create a note, then
 * link a tag to it) are never violated.
 *
 * A transport failure stops the run and leaves the queue intact. A rejection by
 * the server leaves the operation at the head to be retried on later cycles,
 * and after MAX_ATTEMPTS drops it — with its dependants, if it was a create —
 * so one bad row cannot wedge everything behind it. The returned error is what
 * the UI reports; the returned flag says whether the server was reachable.
 */
async function pushQueue(uid: string): Promise<{ reachedServer: boolean; error: string | null }> {
  let error: string | null = null;

  while (queue.length > 0) {
    const op = queue[0];

    try {
      await applyOp(op, uid);
      queue = queue.slice(1);
      await persistQueue();
      publish({});
    } catch (caught) {
      if (isNetworkError(caught)) {
        return { reachedServer: false, error };
      }

      const attempts = op.attempts + 1;
      const message = errorMessage(caught);
      error = message;

      if (attempts >= MAX_ATTEMPTS) {
        // Give up on this operation so one bad row can't wedge the queue.
        // A rejected create takes its dependants (tag links) with it.
        console.warn(`[sync] Dropping ${op.kind} for note ${op.noteId}: ${message}`);
        queue =
          op.kind === 'note.create'
            ? queue.filter((q) => q.noteId !== op.noteId)
            : queue.slice(1);
        await persistQueue();
        publish({});
        // Keep draining — the rest of the queue is independent of this row
        continue;
      }

      // Leave it at the head and come back on the next cycle
      queue = [{ ...op, attempts, lastError: message }, ...queue.slice(1)];
      await persistQueue();
      publish({});
      return { reachedServer: true, error };
    }
  }

  return { reachedServer: true, error };
}

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

async function cycle(): Promise<void> {
  const uid = userId;
  if (!uid) return;
  if (!queueLoaded) await loadQueue();

  publish({ syncing: true });

  let online = true;
  let failure: string | null = null;

  try {
    if (!isOnline()) {
      online = false;
    } else {
      const pushed = await pushQueue(uid);
      online = pushed.reachedServer;
      failure = pushed.error;

      if (online) {
        const results = await Promise.allSettled(
          Array.from(pullers.values()).map((puller) => puller())
        );
        for (const result of results) {
          if (result.status !== 'rejected') continue;
          if (isNetworkError(result.reason)) online = false;
          else failure = errorMessage(result.reason);
        }
      }
    }
  } catch (error) {
    if (isNetworkError(error)) online = false;
    else failure = errorMessage(error);
  }

  // "Settled" means there is nothing left the engine could usefully retry.
  // A rejected operation that was dropped leaves `failure` set so the UI can
  // say so, but it is not something a retry would fix.
  const settled = online && queue.length === 0;

  publish({
    syncing: false,
    offline: !online,
    lastError: failure,
    lastSyncAt: settled ? new Date().toISOString() : state.lastSyncAt,
  });

  if (settled) {
    retryAttempt = 0;
  } else {
    scheduleRetry();
  }
}

/** Runs a full cycle, joining one already in progress rather than stacking. */
export function runSync(): Promise<void> {
  if (inFlight) return inFlight;

  const promise = cycle().finally(() => {
    if (inFlight === promise) inFlight = null;
  });

  inFlight = promise;
  return promise;
}

/** Coalesces bursts of mutations into a single push. */
export function scheduleSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSync();
  }, DEBOUNCE_MS);
}

function scheduleRetry(): void {
  if (retryTimer) return;
  const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt, RETRY_MAX_MS);
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void runSync();
  }, delay);
}

function cancelTimers(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/**
 * Starts the ambient triggers: sync when the app returns to the foreground and
 * when the browser reports the connection is back. Returns a teardown.
 */
export function startSyncEngine(): () => void {
  engineRefCount += 1;

  if (teardownListeners) {
    const existing = teardownListeners;
    return () => {
      engineRefCount -= 1;
      if (engineRefCount <= 0) existing();
    };
  }

  const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') {
      retryAttempt = 0;
      void runSync();
    }
  });

  const unsubscribeConnectivity = subscribeToConnectivity((online) => {
    publish({ offline: !online });
    if (online) {
      retryAttempt = 0;
      void runSync();
    }
  });

  const teardown = () => {
    appStateSub.remove();
    unsubscribeConnectivity();
    cancelTimers();
    teardownListeners = null;
  };
  teardownListeners = teardown;

  return () => {
    engineRefCount -= 1;
    if (engineRefCount <= 0) teardown();
  };
}
