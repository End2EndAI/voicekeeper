import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Small JSON document store used by the offline cache.
 *
 * On native the documents are plain files under documentDirectory/offline/:
 * AsyncStorage on Android is backed by a SQLite database with a 6 MB default
 * ceiling, which a few hundred notes can reach. On web there is no filesystem,
 * so AsyncStorage (localStorage) is used instead.
 *
 * Writes to the same document are serialised so two concurrent callers can
 * never interleave and leave a truncated file behind.
 */

const OFFLINE_DIR = (FileSystem.documentDirectory ?? '') + 'offline/';
const WEB_KEY_PREFIX = '@voicekeeper/offline/';

const useFileSystem = Platform.OS !== 'web' && !!FileSystem.documentDirectory;

/** Per-document write chains, keyed by document name. */
const writeChains = new Map<string, Promise<void>>();

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function filePath(name: string): string {
  return `${OFFLINE_DIR}${safeName(name)}.json`;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(OFFLINE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true });
  }
}

/** Reads a document. Returns null when absent or unreadable — never throws. */
export async function readDocument<T>(name: string): Promise<T | null> {
  try {
    let raw: string | null;

    if (useFileSystem) {
      const path = filePath(name);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      raw = await FileSystem.readAsStringAsync(path);
    } else {
      raw = await AsyncStorage.getItem(WEB_KEY_PREFIX + safeName(name));
    }

    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted or unreadable cache is equivalent to no cache
    return null;
  }
}

/** Writes a document. Rejections are swallowed — the cache is never critical. */
export async function writeDocument(name: string, value: unknown): Promise<void> {
  const key = safeName(name);
  const previous = writeChains.get(key) ?? Promise.resolve();

  const next = previous
    .catch(() => {})
    .then(async () => {
      const raw = JSON.stringify(value);
      if (useFileSystem) {
        await ensureDir();
        await FileSystem.writeAsStringAsync(filePath(name), raw);
      } else {
        await AsyncStorage.setItem(WEB_KEY_PREFIX + key, raw);
      }
    })
    .catch((error) => {
      console.warn(`[localStore] Failed to persist "${name}":`, error);
    })
    .finally(() => {
      if (writeChains.get(key) === next) writeChains.delete(key);
    });

  writeChains.set(key, next);
  return next;
}

/** Removes a document (used on sign-out and account deletion). */
export async function removeDocument(name: string): Promise<void> {
  try {
    if (useFileSystem) {
      await FileSystem.deleteAsync(filePath(name), { idempotent: true });
    } else {
      await AsyncStorage.removeItem(WEB_KEY_PREFIX + safeName(name));
    }
  } catch {
    // Already gone
  }
}
