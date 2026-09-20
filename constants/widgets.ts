/**
 * Shared identifiers for the Android home screen widget.
 *
 * Kept out of the widget component so screens can reference them without
 * pulling the widget's render tree into the iOS and web bundles.
 */

/**
 * Name the widget is registered under. Must match the `name` of the entry in
 * the `react-native-android-widget` plugin config in app.json — the native
 * AppWidgetProvider is generated from it.
 */
export const RECORD_WIDGET_NAME = 'Record';

/**
 * Tapping the widget opens this deep link. `OPEN_URI` is handled natively, so
 * the tap never wakes the JS bundle: the intent fires straight away and
 * expo-router resolves the path to app/record.tsx, which starts recording as
 * soon as it mounts.
 */
export const RECORD_WIDGET_URI = 'voicekeeper://record';
