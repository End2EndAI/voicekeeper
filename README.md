<p align="center">
  <img src="./assets/logo.png" width="120" alt="VoiceKeeper" />
</p>

<h1 align="center">VoiceKeeper</h1>

<p align="center">
  <em>Speak it. Keep it. Organized.</em>
</p>

<p align="center">
  <a href="https://voicekeeper.vercel.app/"><strong>Try the web demo →</strong></a>
  &nbsp;·&nbsp;
  Mobile apps coming soon to the App Store and Play Store
</p>

---

VoiceKeeper is a voice-first note-taking app. Tap to record, and your voice is instantly transcribed and auto-formatted into the structure you want — bullet lists, paragraphs, action items, meeting notes, or a fully custom template you define by example.

Built with React Native (Expo), Supabase, and OpenAI. Runs on iOS, Android, and Web.

---

## Features

- **One-tap recording** with live waveform feedback
- **Auto-transcription** powered by OpenAI Whisper
- **Auto-formatting** into your chosen structure (5 built-in formats + custom templates)
- **Custom instructions** — set persistent rules for tone, language, length, etc.
- **Card-based grid UI** with full-text search (Google Keep style)
- **Cross-platform** — iOS, Android, and Web from a single codebase

**Supported formats:** Bullet List · Paragraph · Action Items · Meeting Notes · Custom Template

---

## How it works

```
You speak into your phone
        │
        ▼
Supabase Edge Function
  ├── OpenAI Whisper  →  transcription
  └── OpenAI GPT      →  formatted note + title
        │
        ▼
Saved to Supabase Postgres (with full-text search)
```

All OpenAI calls go through a Supabase Edge Function — your API key is never exposed to the client.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo) — iOS, Android, Web |
| Speech-to-text | OpenAI Whisper API |
| Auto-formatting | OpenAI GPT |
| Backend | Supabase (Auth + Postgres + Storage + Edge Functions) |
| Deployment | Vercel (web) |

---

## Self-hosting / Development setup

VoiceKeeper is open source under the AGPL-3.0 license. You can run your own instance — you just need to bring your own API keys (BYOK).

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- An [OpenAI](https://platform.openai.com) API key
- (Optional) [Vercel](https://vercel.com) account for web deployment

### 1. Clone and install

```bash
git clone https://github.com/End2EndAI/voicekeeper.git
cd voicekeeper
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **Authentication > Providers** and enable **Email** (disable "Confirm email" for faster testing)
3. Note your **Project URL** and **anon key** from **Settings > API**

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Also create `supabase/.env.local` for local Edge Function development:

```env
OPENAI_API_KEY=sk-your-openai-key
```

### 4. Set up the database and Edge Functions

```bash
# Install Supabase CLI if needed
brew install supabase/tap/supabase   # macOS
# or: npm install -g supabase

# Set your project ID in the Supabase config
# Replace YOUR_PROJECT_REF with your project reference from Settings > General
sed -i '' 's/project_id = ""/project_id = "YOUR_PROJECT_REF"/' supabase/config.toml

# Login and link your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations (tables, RLS policies, triggers, storage bucket)
supabase db push

# Set your OpenAI API key as a Supabase secret
supabase secrets set OPENAI_API_KEY=sk-your-openai-key

# Deploy the Edge Functions
supabase functions deploy process-recording
supabase functions deploy delete-account
```

> **Note:** Do not commit your `project_id` to the repo — `supabase/config.toml` uses an empty `project_id` by default so each self-hoster sets their own.

### 5. Run locally

```bash
# Web
npx expo start --web

# iOS (requires Xcode)
npx expo start --ios

# Android (requires Android Studio)
npx expo start --android
```

> **Note:** Expo automatically loads the `.env` file. The `EXPO_PUBLIC_` prefix is required for client-side access.

---

## Deploy to Vercel (web)

1. Push your repo to GitHub
2. Import the repository at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in the Vercel dashboard:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects the `vercel.json` config

The included `vercel.json` configures the build command (`npx expo export --platform web`), output directory (`dist`), and SPA routing.

---

## Project structure

```
voicekeeper/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (auth guard, providers)
│   ├── index.tsx                 # Home (note grid + search)
│   ├── login.tsx                 # Login / signup
│   ├── record.tsx                # Recording (modal)
│   ├── preview.tsx               # Note preview after processing
│   ├── settings.tsx              # User preferences
│   └── note/[id].tsx             # Note detail / edit
├── components/                   # Reusable UI components
├── contexts/                     # React Context (Auth, Notes, Preferences)
├── services/                     # Business logic (Supabase, processing, GDPR)
├── types/                        # TypeScript type definitions
├── constants/                    # Colors, format options
├── utils/                        # Helpers (alerts, title generation)
├── supabase/
│   ├── migrations/               # SQL migrations (6 files)
│   └── functions/
│       ├── process-recording/    # Edge Function (Whisper + GPT)
│       └── delete-account/       # Edge Function (GDPR account deletion)
├── .env.example                  # Environment template
├── PRIVACY_POLICY.md             # Privacy policy (GDPR)
├── SECURITY.md                   # Security vulnerability reporting
├── app.json                      # Expo config
├── vercel.json                   # Vercel deployment config
└── package.json
```

---

## Database schema

**`notes`** — voice notes with title, formatted text, raw transcription, format type, and optional audio URL. Row-Level Security ensures users can only access their own notes.

**`user_preferences`** — per-user settings: default format, custom template example, and custom instructions. Auto-created on signup via a database trigger.

**`audit_log`** — GDPR accountability log tracking account creation, deletion, and data export requests.

**`recordings` bucket** — private Supabase Storage bucket for audio files, with per-user RLS.

The database also includes server-side functions for GDPR compliance: `export_user_data()` (data portability) and account deletion with full storage cleanup.

---

## Edge Function: `process-recording`

The Edge Function acts as a secure proxy between the app and OpenAI:

1. Validates the user's Supabase JWT
2. Sends audio to OpenAI Whisper for transcription
3. Sends transcription to GPT for formatting (with the user's chosen format + custom instructions)
4. Returns `{ transcription, formatted_text, title }` to the app

This design keeps API keys server-side and centralizes all AI logic for easy iteration.

---

## About

VoiceKeeper is developed by [End2EndAI](https://github.com/End2EndAI). The web app is live and mobile apps are coming soon to the App Store and Play Store. The free tier allows 5 notes per day (limited due to OpenAI API costs). There is no paid subscription yet — one is coming for both the web app and mobile apps.

Developers are welcome to self-host using their own API keys under the AGPL-3.0 license. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved.

---

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

You are free to use, modify, and distribute this software under the terms of the AGPL-3.0. If you deploy a modified version as a network service, you must make your source code available to users of that service.

See [LICENSE](LICENSE) for the full text.
