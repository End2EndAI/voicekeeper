# VoiceKeeper

> **Speak it. Keep it. Organized.**

VoiceKeeper is a voice-first note-taking app — think Google Keep, but voice is the primary input. Speak your notes, and they are instantly transcribed and auto-formatted into the structure you want: bullet list, paragraph, action items, meeting notes, or a fully custom template.

---

## What it does

1. **Tap to record** — one-tap recording with live waveform feedback
2. **Auto-transcribe** — powered by OpenAI Whisper API
3. **Auto-format** — your transcription is shaped into your chosen format
4. **Custom template** — define your own note structure by providing an example; the AI mirrors it
5. **Custom instructions** — set persistent instructions (tone, language, length, etc.) that apply to every note regardless of format
6. **Save and browse** — card-based note grid (Google Keep style), with full-text search

**Supported formats:** Bullet List · Paragraph · Action Items · Meeting Notes · Custom Template

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo) — iOS, Android, Web |
| Speech-to-text | OpenAI Whisper API |
| Auto-formatting | OpenAI gpt-5-nano |
| Backend | Supabase (Auth + Postgres + Storage + Edge Functions) |
| Deployment | Vercel (web) |

All OpenAI API calls are proxied through Supabase Edge Functions — no API keys exposed on the client.

---

## Project structure

```
voicekeeper/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (auth guard, providers)
│   ├── index.tsx                 # Home screen (note grid)
│   ├── login.tsx                 # Login / signup screen
│   ├── record.tsx                # Recording screen (modal)
│   ├── preview.tsx               # Note preview after processing
│   ├── settings.tsx              # Settings screen
│   └── note/
│       └── [id].tsx              # Note detail / edit screen
├── components/                   # Reusable UI components
│   ├── AudioWaveform.tsx         # Waveform visualization
│   ├── FormatBadge.tsx           # Format type badge
│   ├── LoadingOverlay.tsx        # Processing overlay
│   ├── NoteCard.tsx              # Note card for grid
│   ├── NoteGrid.tsx              # Grid layout of cards
│   ├── RecordButton.tsx          # FAB record button
│   └── SearchBar.tsx             # Search input
├── contexts/                     # React Context providers
│   ├── AuthContext.tsx            # Authentication state
│   ├── NotesContext.tsx           # Notes CRUD + search
│   └── PreferencesContext.tsx     # User preferences
├── services/                     # Business logic
│   ├── supabase.ts               # Supabase client init
│   ├── auth.ts                   # Auth operations
│   ├── notes.ts                  # Notes CRUD
│   ├── recording.ts              # Audio recording
│   ├── processing.ts             # Edge Function client
│   └── preferences.ts            # User preferences
├── types/                        # TypeScript types
├── constants/                    # Colors, format options
├── utils/
│   ├── alert.ts                  # Cross-platform Alert (web-compatible)
│   └── titleGenerator.ts         # Date formatting, text helpers
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_fix_new_user_trigger.sql
│   │   ├── 003_add_custom_format.sql
│   │   ├── 004_fix_custom_format_constraint.sql
│   │   └── 005_add_custom_instructions.sql
│   └── functions/
│       └── process-recording/
│           └── index.ts          # Edge Function (Whisper + GPT)
├── docs/                         # Planning specs
├── vercel.json                   # Vercel deployment config
├── app.json                      # Expo config
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- An [OpenAI](https://platform.openai.com) API key
- (Optional) [Vercel](https://vercel.com) account for deployment

### 1. Clone and install

```bash
git clone https://github.com/End2EndAI/voicekeeper
cd voicekeeper
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to **Authentication > Providers** and make sure **Email** is enabled (disable "Confirm email" for faster testing if desired)
3. Note your **Project URL** and **anon key** from **Settings > API** — you'll need them in step 4

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Also create `supabase/.env.local` for the CLI:

```env
OPENAI_API_KEY=sk-your-openai-key
```

### 4. Link Supabase CLI and push the database

Your project ref is the ID in your Supabase project URL (e.g. `pxaqfnczdfikxpjzlcfs`).

```bash
# Install Supabase CLI if needed
brew install supabase/tap/supabase   # macOS
# or: npm install -g supabase

# Login and link your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations (creates tables, RLS policies, triggers, storage bucket)
supabase db push

# Set your OpenAI API key as a secret on the edge function
supabase secrets set OPENAI_API_KEY=sk-your-openai-key

# Deploy the Edge Function
supabase functions deploy process-recording
```

### 5. Run locally

```bash
# Web
npx expo start --web

# iOS (requires Xcode)
npx expo start --ios

# Android (requires Android Studio)
npx expo start --android
```

> **Note:** The `.env` file is loaded automatically by Expo. Do not rename it to `.env.local` — Expo only reads `.env` and `.env.local` but the Expo public variable prefix (`EXPO_PUBLIC_`) is required for client-side access.

---

## Deploy to Vercel

VoiceKeeper is ready to deploy as a static web app on Vercel.

### Quick deploy

1. Push your repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Vercel will auto-detect the `vercel.json` configuration
4. Add environment variables in the Vercel dashboard:

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://your-project-id.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

5. Deploy!

### Manual deploy

```bash
# Build for web
npx expo export --platform web

# The output is in the dist/ folder
# Deploy with Vercel CLI:
npx vercel --prod
```

### Vercel settings

The included `vercel.json` configures:
- **Build command:** `npx expo export --platform web`
- **Output directory:** `dist`
- **Rewrites:** all routes fall back to `index.html` for client-side routing

---

## Supabase setup checklist

| Step | Command |
|---|---|
| Create Supabase project | [supabase.com/dashboard](https://supabase.com/dashboard) |
| Link CLI to project | `supabase link --project-ref YOUR_PROJECT_REF` |
| Push migrations to remote DB | `supabase db push` |
| Set OpenAI API key secret | `supabase secrets set OPENAI_API_KEY=sk-...` |
| Deploy Edge Function | `supabase functions deploy process-recording` |
| Copy env vars to `.env` | See step 3 above |

### Database tables

**notes**: stores all voice notes with title, formatted text, raw transcription, format type, and optional audio URL. RLS ensures users can only access their own notes.

**user_preferences**: stores per-user preferences: default format, custom template example, and custom instructions. Auto-created on signup via the `handle_new_user` trigger.

### Edge Function: process-recording

#### Why an Edge Function instead of calling OpenAI directly from the app?

Calling OpenAI directly from a mobile or web app would require shipping the API key inside the client bundle — where it can be extracted by anyone with access to the app. The Edge Function acts as a secure server-side proxy:

- The `OPENAI_API_KEY` is stored as a Supabase secret, never exposed to the client
- The function validates the user's Supabase JWT before forwarding the request to OpenAI, so only authenticated users can trigger API calls
- It centralizes all AI logic (transcription + formatting) in one place, making it easy to iterate on prompts, swap models, or add rate limiting without a new app release

The app sends audio to the Edge Function → the function calls Whisper for transcription, then GPT for formatting → the result is returned to the app and saved to Postgres.

#### Input

Accepts a POST with `multipart/form-data` containing:

| Field | Required | Description |
|---|---|---|
| `audio` | ✅ | Audio file to transcribe |
| `format_type` | ✅ | One of `bullet_list`, `paragraph`, `action_items`, `meeting_notes`, `custom` |
| `custom_example` | — | Example note for `custom` format (mirrors structure) |
| `custom_instructions` | — | Free-text instructions appended to every prompt (tone, language, etc.) |

Returns:

```json
{
  "transcription": "Raw text from Whisper...",
  "formatted_text": "Formatted output from GPT...",
  "title": "Auto-generated title"
}
```

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
  └── OpenAI gpt-5-nano  →  formatted note + title
        │
        ▼
Supabase Postgres  →  notes table (RLS per user)
Supabase Storage   →  recordings bucket (private)
```

---

## Implementation status

| Phase | Status |
|---|---|
| Product Brief | ✅ Done |
| PRD | ✅ Done |
| Architecture | ✅ Done |
| Epics & Stories | ✅ Done (9 epics, 33 stories) |
| Sprint Plan | ✅ Done (4 sprints) |
| Implementation | ✅ Done |
| Vercel Deployment Config | ✅ Done |

---

## License

Private repository — all rights reserved.
