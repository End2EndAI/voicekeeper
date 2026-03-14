# Architecture Document: VoiceKeeper

## 1. Overview

### 1.1 System Summary

VoiceKeeper is a cross-platform voice-first note-taking application built with React Native (Expo) on the frontend and Supabase as the backend-as-a-service. The app captures audio, transcribes it via OpenAI Whisper API, auto-formats the text via OpenAI GPT API, and stores the result in Supabase Postgres. All external API calls are proxied through Supabase Edge Functions to protect API keys.

### 1.2 Architecture Style

**Client-Server with BaaS (Backend-as-a-Service)**

- The React Native client handles UI, audio recording, and local state
- Supabase provides authentication, database, storage, and edge functions
- Edge Functions act as a thin serverless backend for OpenAI API calls
- No custom backend server is required

### 1.3 References

- PRD: VoiceKeeper v1.0 (MVP)
- Product Brief: VoiceKeeper v1.0 (MVP)

## 2. High-Level Architecture

```
+---------------------------------------------------+
|                  React Native (Expo)               |
|                                                     |
|  +-------------+  +----------+  +--------------+   |
|  | Auth Screens |  | Home Grid|  | Recording UI |   |
|  +-------------+  +----------+  +--------------+   |
|  | Note Detail  |  | Settings |  | Note Preview |   |
|  +-------------+  +----------+  +--------------+   |
|                                                     |
|  +-----------------------------------------------+ |
|  |           Services Layer                       | |
|  | AuthService | NoteService | RecordingService   | |
|  | FormatService | PreferencesService             | |
|  +-----------------------------------------------+ |
+-------------------------+-------------------------+
                          |
                          | HTTPS
                          |
+-------------------------v-------------------------+
|                    Supabase                        |
|                                                     |
|  +-------------+  +-----------+  +--------------+  |
|  | Auth         |  | Postgres  |  | Storage      |  |
|  | (email/pass) |  | (notes,   |  | (audio       |  |
|  |              |  |  prefs)   |  |  files)      |  |
|  +-------------+  +-----------+  +--------------+  |
|                                                     |
|  +-----------------------------------------------+ |
|  |           Edge Functions                       | |
|  | process-recording (Whisper + GPT)              | |
|  +-----------------------------------------------+ |
+-------------------------+-------------------------+
                          |
                          | HTTPS
                          |
+-------------------------v-------------------------+
|                  OpenAI API                        |
|  +------------------+  +----------------------+   |
|  | Whisper (STT)     |  | gpt-5-nano (Format) |   |
|  +------------------+  +----------------------+   |
+---------------------------------------------------+
```

## 3. Technology Stack

| Layer | Technology | Version/Notes |
|---|---|---|
| **Framework** | React Native with Expo | SDK 52+ (managed workflow) |
| **Language** | TypeScript | Strict mode enabled |
| **Navigation** | Expo Router | File-based routing |
| **State Management** | React Context + useReducer | AuthContext, NotesContext, PreferencesContext |
| **Audio Recording** | expo-av | Audio.Recording API |
| **HTTP Client** | Supabase JS Client | @supabase/supabase-js v2 |
| **Auth** | Supabase Auth | Email/password provider |
| **Database** | Supabase Postgres | With Row Level Security |
| **File Storage** | Supabase Storage | Private buckets |
| **Edge Functions** | Supabase Edge Functions | Deno runtime |
| **STT API** | OpenAI Whisper API | whisper-1 model |
| **Formatting API** | OpenAI Chat Completions | gpt-5-nano model |
| **Testing** | Jest + React Native Testing Library | Unit and integration tests |

## 4. Project Structure

```
voicekeeper/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (auth guard, providers)
│   ├── index.tsx                 # Home screen (note grid)
│   ├── login.tsx                 # Login/signup screen
│   ├── note/
│   │   └── [id].tsx              # Note detail/edit screen
│   ├── record.tsx                # Recording screen (modal)
│   ├── preview.tsx               # Note preview after processing
│   └── settings.tsx              # Settings screen
├── components/
│   ├── NoteCard.tsx              # Note card for grid display
│   ├── NoteGrid.tsx              # Masonry/grid layout of cards
│   ├── RecordButton.tsx          # FAB record button
│   ├── AudioWaveform.tsx         # Waveform visualization
│   ├── FormatBadge.tsx           # Format type badge
│   ├── SearchBar.tsx             # Search input
│   └── LoadingOverlay.tsx        # Processing state overlay
├── contexts/
│   ├── AuthContext.tsx            # Authentication state
│   ├── NotesContext.tsx           # Notes data and operations
│   └── PreferencesContext.tsx     # User preferences state
├── services/
│   ├── supabase.ts               # Supabase client initialization
│   ├── auth.ts                   # Auth operations (signup, login, logout)
│   ├── notes.ts                  # CRUD operations for notes
│   ├── recording.ts              # Audio recording management
│   ├── processing.ts             # Calls edge function for transcription + formatting
│   └── preferences.ts            # User preferences CRUD
├── types/
│   └── index.ts                  # TypeScript type definitions
├── constants/
│   └── formats.ts                # Format type definitions and labels
├── utils/
│   └── titleGenerator.ts         # Auto-generate note title from text
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # Notes + preferences tables
│   └── functions/
│       └── process-recording/
│           └── index.ts           # Edge function: Whisper + GPT
├── app.json                       # Expo config
├── tsconfig.json
├── package.json
└── .env.local                     # SUPABASE_URL, SUPABASE_ANON_KEY
```

## 5. Component Architecture

### 5.1 Context Providers (State Management)

```
<AuthProvider>              ← Manages auth state, session persistence
  <PreferencesProvider>     ← Manages user format preferences
    <NotesProvider>         ← Manages notes list, search, CRUD
      <Stack />             ← Expo Router navigation
    </NotesProvider>
  </PreferencesProvider>
</AuthProvider>
```

**AuthContext**
- State: `user`, `session`, `loading`
- Actions: `signUp`, `signIn`, `signOut`
- Listens to `supabase.auth.onAuthStateChange`

**NotesContext**
- State: `notes[]`, `searchQuery`, `filteredNotes[]`, `loading`
- Actions: `fetchNotes`, `createNote`, `updateNote`, `deleteNote`, `setSearchQuery`
- Fetches notes on mount, provides real-time list to consumers

**PreferencesContext**
- State: `defaultFormat`, `loading`
- Actions: `setDefaultFormat`
- Loads preference on auth, persists to Supabase

### 5.2 Screen Flow

```
[Login] ──auth──> [Home/NoteGrid]
                      │
          ┌───────────┼────────────┐
          │           │            │
     [Record]    [NoteDetail]  [Settings]
          │         [id]
          v
     [Preview]
     (save → Home)
```

### 5.3 Key Component Responsibilities

| Component | Responsibility |
|---|---|
| `NoteGrid` | Renders FlatList/MasonryList of NoteCard components |
| `NoteCard` | Displays title, preview, timestamp, FormatBadge; tappable |
| `RecordButton` | Floating action button, triggers navigation to Record screen |
| `AudioWaveform` | Visualizes audio metering data during recording |
| `SearchBar` | Text input that updates NotesContext searchQuery |
| `LoadingOverlay` | Displays during transcription/formatting with progress text |

## 6. Data Architecture

### 6.1 Database Schema (Supabase Postgres)

```sql
-- Notes table
CREATE TABLE notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    formatted_text TEXT NOT NULL,
    raw_transcription TEXT NOT NULL,
    format_type TEXT CHECK (format_type IN (
        'bullet_list', 'paragraph', 'action_items', 'meeting_notes'
    )) NOT NULL,
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_search ON notes USING gin(to_tsvector('english',
    title || ' ' || formatted_text || ' ' || raw_transcription));

-- Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own notes"
    ON notes FOR ALL
    USING (auth.uid() = user_id);

-- User preferences table
CREATE TABLE user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    default_format TEXT CHECK (default_format IN (
        'bullet_list', 'paragraph', 'action_items', 'meeting_notes'
    )) DEFAULT 'bullet_list' NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own preferences"
    ON user_preferences FOR ALL
    USING (auth.uid() = user_id);

-- Auto-create preferences on user signup (via trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 6.2 Storage Buckets

```
Bucket: recordings (private)
├── Policy: Users can upload to their own folder (auth.uid()/)
├── Policy: Users can read from their own folder
└── Path pattern: {user_id}/{note_id}.m4a
```

### 6.3 TypeScript Types

```typescript
type FormatType = 'bullet_list' | 'paragraph' | 'action_items' | 'meeting_notes';

interface Note {
    id: string;
    user_id: string;
    title: string;
    formatted_text: string;
    raw_transcription: string;
    format_type: FormatType;
    audio_url: string | null;
    created_at: string;
    updated_at: string;
}

interface UserPreferences {
    id: string;
    user_id: string;
    default_format: FormatType;
    updated_at: string;
}

interface ProcessingResult {
    transcription: string;
    formatted_text: string;
    title: string;
}
```

## 7. Edge Function Architecture

### 7.1 process-recording

A single Supabase Edge Function that handles both transcription and formatting in one request, reducing round trips.

**Endpoint:** `POST /functions/v1/process-recording`

**Request:**
```
Content-Type: multipart/form-data
Authorization: Bearer <supabase_jwt>

Fields:
- audio: File (the recorded audio)
- format_type: string (bullet_list | paragraph | action_items | meeting_notes)
```

**Response:**
```json
{
    "transcription": "Raw text from Whisper...",
    "formatted_text": "Formatted output from GPT...",
    "title": "Auto-generated title..."
}
```

**Internal Flow:**
1. Validate JWT (Supabase handles this automatically)
2. Extract audio file and format_type from multipart form
3. Call OpenAI Whisper API with audio file to get transcription
4. Construct GPT prompt based on format_type
5. Call OpenAI Chat Completions with transcription + format prompt
6. Parse GPT response to extract formatted text and title
7. Return combined result

### 7.2 GPT Format Prompts

Each format type uses a specific system prompt:

| Format | Prompt Strategy |
|---|---|
| **bullet_list** | "Extract the key points from this transcription and format them as a concise bulleted list." |
| **paragraph** | "Rewrite this transcription as clean, well-structured prose paragraphs. Fix grammar and remove filler words." |
| **action_items** | "Extract all action items and tasks from this transcription. Format each as a checkbox item (- [ ] task)." |
| **meeting_notes** | "Structure this transcription as meeting notes with sections: Key Topics, Decisions Made, Action Items." |

All prompts also include: "Generate a short title (5 words max) for this note. Return JSON with fields: title, content."

## 8. Data Flow: Record to Save

```
1. User taps Record
   └─> expo-av Audio.Recording.createAsync()
       └─> Recording in progress (metering data -> waveform)

2. User taps Stop
   └─> recording.stopAndUnloadAsync()
       └─> Local audio file URI

3. Processing begins
   ├─> Upload audio to Supabase Storage (background, if enabled)
   └─> Send audio to Edge Function: process-recording
       ├─> Edge Function calls Whisper API -> transcription
       └─> Edge Function calls GPT API -> formatted_text + title
           └─> Returns { transcription, formatted_text, title }

4. Preview screen
   └─> Display formatted_text, allow editing
       └─> User taps Save

5. Save to database
   └─> supabase.from('notes').insert({
           user_id, title, formatted_text,
           raw_transcription, format_type, audio_url
       })
       └─> Note appears in grid on Home
```

## 9. Authentication Flow

```
App Launch
    │
    v
Check session (supabase.auth.getSession())
    │
    ├─ Session valid ──> Home Screen
    │
    └─ No session ──> Login Screen
                          │
                    ┌─────┴──────┐
                    │            │
                Sign Up      Sign In
                    │            │
                    └─────┬──────┘
                          │
                    supabase.auth.*
                          │
                    onAuthStateChange
                          │
                          v
                    Home Screen
```

- Sessions are managed by Supabase Auth
- On mobile: tokens stored via expo-secure-store
- On web: tokens stored in localStorage (Supabase default)
- Auth state change listener updates AuthContext globally

## 10. Search Architecture

For MVP, search uses Postgres full-text search via the GIN index:

```typescript
// Client-side service call
const searchNotes = async (query: string) => {
    const { data } = await supabase
        .from('notes')
        .select('*')
        .or(`title.ilike.%${query}%,formatted_text.ilike.%${query}%,raw_transcription.ilike.%${query}%`)
        .order('created_at', { ascending: false });
    return data;
};
```

For better performance with larger datasets, upgrade to `textSearch` with the GIN index:

```typescript
const searchNotes = async (query: string) => {
    const { data } = await supabase
        .from('notes')
        .select('*')
        .textSearch('raw_transcription', query)
        .order('created_at', { ascending: false });
    return data;
};
```

For MVP, client-side filtering of pre-fetched notes is acceptable for the initial implementation, with server-side search as an optimization.

## 11. Error Handling Strategy

| Scenario | Handling |
|---|---|
| Microphone permission denied | Show explanation screen with button to open system settings |
| Recording fails to start | Show error toast, allow retry |
| Network error during processing | Preserve local audio file, show retry button with error message |
| Whisper API error (in Edge Function) | Return error response, client shows retry option |
| GPT formatting error | Fall back to raw transcription as the note content |
| Supabase insert fails | Show error toast, keep note in local state for retry |
| Session expired | Redirect to login, preserve any in-progress work |

## 12. Security Architecture

### 12.1 API Key Protection

- OpenAI API key is stored as a secret in Supabase Edge Function environment
- Client never has access to the OpenAI key
- Client authenticates to Edge Functions via Supabase JWT
- Edge Functions validate the JWT before processing

### 12.2 Data Isolation

- Supabase RLS policies enforce `auth.uid() = user_id` on all tables
- Storage bucket policies enforce per-user folder access
- No admin/service role key in client code
- Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` in client (both safe to expose)

### 12.3 Environment Variables

**Client (.env.local):**
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Edge Function (Supabase secrets):**
```
OPENAI_API_KEY=sk-...
```

## 13. Performance Considerations

| Concern | Strategy |
|---|---|
| Recording to saved note latency | Single Edge Function call chains Whisper + GPT to reduce round trips |
| Note grid rendering with many notes | FlatList with pagination (load 20 notes at a time) |
| Audio file size | m4a format with reasonable bitrate keeps files small (under 1 MB for 5 min) |
| Image/asset loading | No heavy assets in MVP |
| App startup time | Lazy load non-critical screens; auth check is fast |

## 14. Deployment Architecture

### 14.1 Frontend

- **Development:** Expo Dev Client on physical devices + Expo Go for quick testing
- **Web:** Expo export for web, deployed as static site (Vercel, Netlify, or Supabase Hosting)
- **iOS/Android:** EAS Build for app store builds, EAS Update for OTA updates

### 14.2 Backend

- **Supabase Project:** Single project for auth, database, storage, edge functions
- **Edge Functions:** Deployed via `supabase functions deploy process-recording`
- **Database Migrations:** Managed via `supabase db push` or migration files

### 14.3 Environments

| Environment | Purpose |
|---|---|
| Local | Development with Supabase local (supabase start) |
| Staging | Supabase project for testing before production |
| Production | Supabase project with production data |

## 15. Testing Strategy

| Level | Tool | Scope |
|---|---|---|
| Unit Tests | Jest | Services, utilities, context reducers |
| Component Tests | React Native Testing Library | Individual components render and behavior |
| Integration Tests | Jest + mocked Supabase | Full flows (record -> process -> save) |
| E2E Tests | (Post-MVP) Detox or Maestro | Full app flows on device |

Key test scenarios:
- Auth flow: signup, login, session persistence, logout
- Recording: start, stop, cancel, max duration enforcement
- Processing: successful transcription + formatting, error handling, retry
- Notes: create, read, update, delete, search
- Preferences: set default format, format applied to new notes

## 16. Constraints and Trade-offs

| Decision | Trade-off | Rationale |
|---|---|---|
| Post-recording transcription (not streaming) | User waits after recording | Simpler implementation; Whisper batch API is more reliable than streaming alternatives |
| Single Edge Function for both APIs | Tighter coupling | Reduces latency (one round trip instead of two); simpler client code |
| React Context over Redux/Zustand | Less scalable state management | Sufficient for MVP complexity; avoids extra dependency |
| Supabase over custom backend | Less flexibility | Dramatically reduces backend work; auth + DB + storage + functions in one |
| m4a recording format | Not universally supported | Best compression/quality ratio; Whisper supports it; Expo AV default |
| Client-side search for MVP | Does not scale to thousands of notes | Simple implementation; server-side search via GIN index is ready when needed |

---

*Architecture Document: VoiceKeeper v1.0 (MVP)*
*Created: 2026-03-11*
*Based on: PRD v1.0, Product Brief v1.0*
