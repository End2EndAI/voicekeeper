import { consumePendingRoute, setPendingRoute } from '../utils/pendingRoute';

describe('pendingRoute', () => {
  // The module holds process-level state; drain it between cases.
  afterEach(() => {
    consumePendingRoute();
  });

  it('replays a route the widget deep links into', () => {
    setPendingRoute('/record');
    expect(consumePendingRoute()).toBe('/record');
  });

  it('yields a stored route only once', () => {
    setPendingRoute('/record');
    consumePendingRoute();
    expect(consumePendingRoute()).toBeNull();
  });

  it('returns null when nothing is pending', () => {
    expect(consumePendingRoute()).toBeNull();
  });

  it('ignores routes outside the allowlist', () => {
    setPendingRoute('/settings');
    expect(consumePendingRoute()).toBeNull();
  });

  it('does not replay dynamic route patterns', () => {
    // expo-router reports these unresolved, so replaying them would navigate
    // to a literal "[id]".
    setPendingRoute('/note/[id]');
    expect(consumePendingRoute()).toBeNull();
  });

  it('drops a stored route when a later navigation is not replayable', () => {
    setPendingRoute('/record');
    setPendingRoute('/');
    expect(consumePendingRoute()).toBeNull();
  });
});
