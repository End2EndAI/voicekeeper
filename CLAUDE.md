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
