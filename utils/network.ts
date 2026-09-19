/**
 * Lightweight connectivity helpers.
 *
 * The app ships without a native connectivity module, so "offline" is inferred
 * rather than observed: `navigator.onLine` where the platform provides it, and
 * otherwise the shape of the error a request came back with. That is enough for
 * the sync engine, which only needs to tell "the network refused us, retry
 * later" apart from "the server rejected this, stop retrying".
 */

const NETWORK_ERROR_PATTERNS = [
  'network request failed',
  'failed to fetch',
  'network error',
  'load failed',
  'connection',
  'econnrefused',
  'econnreset',
  'enotfound',
  'etimedout',
  'timeout',
  'aborted',
  'offline',
];

/** Best-effort guess at whether the device currently has connectivity. */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  // No signal available (native): assume online and let requests decide.
  return true;
}

/**
 * True when the failure looks like a transport problem rather than a rejection
 * by the server. Transport problems keep their operation in the outbox; server
 * rejections eventually drop it so the queue can't wedge forever.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object') {
    const err = error as { name?: string; code?: string; message?: string; status?: number };

    // supabase-js wraps fetch failures in these before they reach us
    if (err.name === 'AuthRetryableFetchError' || err.name === 'FunctionsFetchError') return true;
    if (err.name === 'TypeError' && !err.status) return true;

    // PostgREST reached and answered — that is a server rejection, not a network fault
    if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) return false;
    if (typeof err.status === 'number' && err.status >= 500) return true;

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return true;
  }

  const message = (
    typeof error === 'string' ? error : (error as { message?: string }).message ?? ''
  ).toLowerCase();

  if (!message) return false;
  return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Subscribe to browser connectivity events. Returns an unsubscribe function.
 * On platforms without the events this is a no-op and the sync engine falls
 * back to its retry timer.
 */
export function subscribeToConnectivity(listener: (online: boolean) => void): () => void {
  if (
    typeof window === 'undefined' ||
    typeof window.addEventListener !== 'function'
  ) {
    return () => {};
  }

  const onOnline = () => listener(true);
  const onOffline = () => listener(false);

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
