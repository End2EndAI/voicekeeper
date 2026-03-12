# VoiceKeeper

> **Speak it. Keep it. Organized.**

VoiceKeeper is a voice-first note-taking app — think Google Keep, but voice is the primary input. Speak your notes, and they are instantly transcribed and auto-formatted into the structure you want: bullet list, paragraph, action items, or meeting notes.

---

## What it does

1. **Tap to record** — one-tap recording with live waveform feedback
2. **Auto-transcribe** — powered by OpenAI Whisper API
3. **Auto-format** — your transcription is shaped into your chosen format
4. **Save and browse** — card-based note grid (Google Keep style), with full-text search

**Supported formats:** Bullet List · Paragraph · Action Items · Meeting Notes

The format is set as a preference before recording and can be overridden per note.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo) — iOS, Android, Web |
| Speech-to-text | OpenAI Whisper API |
| Auto-formatting | OpenAI GPT API |
| Backend | Supabase (Auth + Postgres + Storage + Edge Functions) |
| Audio storage | Supabase Storage |

All OpenAI API calls are proxied through Supabase Edge Functions — no API keys exposed on the client.

---

## Architecture

```
React Native (Expo)
  │
  ├── Auth (Supabase Auth)
  ├── Home grid / Search
  ├── Recording UI (expo-av)
  └── Note viewer / editor
        │
        ▼
Supabase Edge Function: process-recording
  ├── OpenAI Whisper API  →  transcription
  └── OpenAI GPT API      →  formatted note
        │
        ▼
Supabase Postgres  →  notes table (RLS per user)
Supabase Storage   →  recordings bucket (private)
```

---

## Project structure (planned)

```
voicekeeper/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login, signup
│   ├── (tabs)/             # Home, search, settings
│   └── note/[id].tsx       # Note detail view
├── components/             # Reusable UI components
├── contexts/               # Auth context, notes context
├── services/               # Supabase client, API calls
├── supabase/
│   └── functions/          # Edge Functions (process-recording)
└── docs/                   # Planning and implementation specs
    ├── planning/
    │   ├── product-brief.md
    │   ├── prd.md
    │   ├── architecture.md
    │   └── epics.md
    └── implementation/
        ├── sprint-status.yaml
        └── stories/        # 33 implementation stories (E1-S1 … E9-S3)
```

---

## Implementation plan

The project is fully specced and ready to build. Planning was done autonomously using the [BMAD Method](https://github.com/bmad-method/bmad-method).

| Phase | Output | Status |
|---|---|---|
| Product Brief | `docs/planning/product-brief.md` | ✅ Done |
| PRD | `docs/planning/prd.md` | ✅ Done |
| Architecture | `docs/planning/architecture.md` | ✅ Done |
| Epics | `docs/planning/epics.md` | ✅ Done (9 epics) |
| Sprint Plan | `docs/implementation/sprint-status.yaml` | ✅ Done (4 sprints) |
| Stories | `docs/implementation/stories/` | ✅ Done (33 stories) |
| Implementation | — | 🔜 Next |

### Sprint overview

| Sprint | Focus |
|---|---|
| Sprint 1 | Project setup + Authentication |
| Sprint 2 | Voice recording + Transcription & formatting |
| Sprint 3 | Note management + Settings |
| Sprint 4 | Search + Audio storage + Polish |

---

## Getting started

> Implementation is in progress. Setup instructions will be added as the project is scaffolded.

**Prerequisites (planned):**
- Node.js 20+
- Expo CLI
- Supabase account
- OpenAI API key

```bash
git clone https://github.com/End2EndAI/voicekeeper
cd voicekeeper
npm install
cp .env.example .env.local   # Add Supabase + OpenAI keys
npx expo start
```

---

## License

Private repository — all rights reserved.
