/**
 * A deep link can land on a protected screen while the user is signed out —
 * tapping the Android record widget after a session expires, for example. The
 * router sends them to /login, and without this the intent is lost: signing in
 * would drop them on the home screen instead of the recorder.
 *
 * Held in memory on purpose. A pending intent should not outlive the process:
 * resuming a record intent from a previous launch would surprise the user.
 */

/**
 * Paths worth replaying after sign-in. Deliberately an allowlist of static
 * routes — expo-router reports dynamic routes by their pattern (`/note/[id]`)
 * rather than a real id, so those cannot be replayed as-is.
 */
const REPLAYABLE_ROUTES = ['/record'];

let pendingRoute: string | null = null;

/**
 * Remember where a signed-out navigation was headed. Anything outside the
 * allowlist clears the slot rather than filling it, so a stale intent can
 * never be replayed by a later sign-in.
 */
export function setPendingRoute(path: string): void {
  pendingRoute = REPLAYABLE_ROUTES.includes(path) ? path : null;
}

/** Read and clear the pending route. */
export function consumePendingRoute(): string | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}
