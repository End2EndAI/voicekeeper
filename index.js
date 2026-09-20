// Custom entry point: expo-router still owns the app, but the Android widget
// needs its headless task registered at bundle load, before the launcher can
// ask us to draw anything.
import 'expo-router/entry';

import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Required lazily so the widget code stays out of the iOS and web bundles.
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./widgets/widget-task-handler');

  registerWidgetTaskHandler(widgetTaskHandler);
}
