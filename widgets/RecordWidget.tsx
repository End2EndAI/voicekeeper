import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';
import { Colors } from '../constants/colors';
import { RECORD_WIDGET_URI } from '../constants/widgets';

// The palette is typed as `string`; the widget style props want hex literals.
const CORAL = Colors.recording as HexColor;
const SURFACE = Colors.surface as HexColor;
const TEXT = Colors.text as HexColor;

// Fill-only paths: the RemoteViews SVG renderer handles these more reliably
// than stroked ones across launchers.
const MIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFFFFF">
  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
  <path d="M17 11a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0z" />
</svg>`;

export function RecordWidget() {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: RECORD_WIDGET_URI }}
      accessibilityLabel="Record a VoiceKeeper note"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SURFACE,
        borderRadius: 28,
        paddingHorizontal: 14,
        flexGap: 10,
      }}
    >
      <FlexWidget
        style={{
          height: 44,
          width: 44,
          borderRadius: 22,
          backgroundColor: CORAL,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SvgWidget svg={MIC_SVG} style={{ height: 22, width: 22 }} />
      </FlexWidget>
      <TextWidget
        text="Record"
        style={{ fontSize: 15, fontWeight: '600', color: TEXT }}
      />
    </FlexWidget>
  );
}
