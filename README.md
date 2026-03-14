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
├── utils/                        # Helpers
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
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
2. Go to **SQL Editor** and run the contents of `supabase/migrations/001_initial_schema.sql` — this creates the `notes` table, `user_preferences` table, RLS policies, triggers, and the `recordings` storage bucket
3. Go to **Authentication > Providers** and make sure **Email** is enabled (disable "Confirm email" for faster testing if desired)
4. Note your project URL and anon key from **Settings > API**

### 3. Set up the Edge Function

The `process-recording` Edge Function handles Whisper transcription and GPT formatting server-side.

**Option A: Deploy via Supabase CLI**

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login and link your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set your OpenAI API key as a secret
supabase secrets set OPENAI_API_KEY=sk-your-openai-key

# Deploy the Edge Function
supabase functions deploy process-recording
```

**Option B: Deploy via Supabase Dashboard**

1. Go to **Edge Functions** in your Supabase dashboard
2. Create a new function called `process-recording`
3. Paste the contents of `supabase/functions/process-recording/index.ts`
4. Go to **Project Settings > Edge Functions > Secrets** and add `OPENAI_API_KEY`

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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

| Step | Done? |
|---|---|
| Create Supabase project | |
| Run `001_initial_schema.sql` in SQL Editor | |
| Enable Email auth provider | |
| Deploy `process-recording` Edge Function | |
| Set `OPENAI_API_KEY` secret | |
| Copy project URL and anon key to `.env.local` | |

### Database tables

**notes**: stores all voice notes with title, formatted text, raw transcription, format type, and optional audio URL. RLS ensures users can only access their own notes.

**user_preferences**: stores the default format preference per user. Auto-created on signup via trigger.

### Edge Function: process-recording

Accepts a POST with `multipart/form-data` containing an `audio` file and `format_type` string. Returns:

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
