import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { RECORD_WIDGET_NAME } from '../constants/widgets';
import { RecordWidget } from './RecordWidget';

const WIDGETS = {
  [RECORD_WIDGET_NAME]: RecordWidget,
} as const;

/**
 * Runs in a headless JS task whenever the launcher needs the widget redrawn.
 * No app state is available here — the React tree in app/_layout.tsx is not
 * mounted — so the widget renders from static props only.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const Widget = WIDGETS[props.widgetInfo.widgetName as keyof typeof WIDGETS];
  if (!Widget) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<Widget />);
      break;

    case 'WIDGET_CLICK':
      // Unreachable: the widget uses OPEN_URI, which the native side handles
      // without starting a headless task.
      break;

    case 'WIDGET_DELETED':
      break;
  }
}
