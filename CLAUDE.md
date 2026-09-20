# VoiceKeeper — Claude Code Notes

## Android Emulator Troubleshooting

### "Legacy API keys are disabled" on sign in

**Symptom:** The Android emulator shows "Legacy API keys are disabled" when trying to sign in, even though the `.env` has a valid `sb_publishable_` key.

**Root cause:** The emulator is loading a stale cached bundle from a previous Expo session (different worktree, different Supabase project, old JWT anon key format).

**Fix:**

```bash
# 1. Clear all app data (wipes cached bundle + stored session)
adb shell pm clear com.voicekeeper.app

# 2. Set up ADB reverse tunnel so emulator reaches host Metro server
adb reverse tcp:8081 tcp:8081

# 3. Start Metro from the correct worktree
npm run android

# 4. If the emulator doesn't load automatically, open the URL directly
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```

**Why `adb reverse` is needed:** The Android emulator can't reach the host machine via its LAN IP (`192.168.1.x`) reliably. The reverse tunnel maps `localhost:8081` inside the emulator to `localhost:8081` on the host, so Expo Go connects correctly.

## Android Home Screen Widget

The record widget (`widgets/RecordWidget.tsx`) is built with
`react-native-android-widget`, configured by the plugin entry in `app.json`.
Tapping it fires an `OPEN_URI` intent for `voicekeeper://record`, which
expo-router resolves to `app/record.tsx` — that screen starts recording as soon
as it mounts, so the widget needs no native recording code of its own.

**The widget cannot run in Expo Go.** It adds native code, so the Expo Go
workflow in the troubleshooting section above will not load it. Use a
development build instead:

```bash
npx expo run:android                              # local build
eas build --platform android --profile preview    # installable APK
```

(The `development` EAS profile sets `developmentClient: true`, which also needs
`expo-dev-client` added to the project.)

`index.js` is the entry point (not `expo-router/entry` directly) because the
widget's headless task must be registered at bundle load. Keep the
`RECORD_WIDGET_NAME` constant in `constants/widgets.ts` in step with the widget
`name` in the `app.json` plugin config — the native AppWidgetProvider class is
generated from it.
