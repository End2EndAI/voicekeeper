# Epics: VoiceKeeper MVP

## Epic Overview

| # | Epic | Priority | Dependencies | Estimated Stories |
|---|---|---|---|---|
| E1 | Project Setup and Infrastructure | Must Have | None | 3 |
| E2 | Authentication | Must Have | E1 | 3 |
| E3 | Voice Recording | Must Have | E1 | 4 |
| E4 | Transcription and Auto-Formatting | Must Have | E1, E3 | 4 |
| E5 | Note Management | Must Have | E1, E2 | 5 |
| E6 | Settings and Preferences | Must Have | E2 | 2 |
| E7 | Search | Must Have | E5 | 2 |
| E8 | Audio Storage | Should Have | E2, E3 | 2 |
| E9 | Polish and Integration Testing | Must Have | E1-E7 | 3 |

## Recommended Sprint Order

**Sprint 1:** E1 (Project Setup) + E2 (Authentication)
**Sprint 2:** E3 (Voice Recording) + E4 (Transcription/Formatting)
**Sprint 3:** E5 (Note Management) + E6 (Settings)
**Sprint 4:** E7 (Search) + E8 (Audio Storage) + E9 (Polish)

---

## E1: Project Setup and Infrastructure

**Goal:** Scaffold the Expo project, configure Supabase, set up the database schema, and deploy the Edge Function skeleton. All subsequent epics depend on this foundation.

**Requirements Covered:** NFR-SEC-01, NFR-SEC-02, NFR-COMPAT-01 through NFR-COMPAT-04

### Stories

**E1-S1: Initialize Expo Project with TypeScript**
- Create Expo project with `create-expo-app` using TypeScript template
- Configure Expo Router for file-based navigation
- Set up project structure: `app/`, `components/`, `contexts/`, `services/`, `types/`, `constants/`, `utils/`
- Configure tsconfig.json with strict mode
- Install core dependencies: `@supabase/supabase-js`, `expo-av`, `expo-secure-store`
- Verify the app builds and runs on web, iOS simulator, and Android emulator
- **Acceptance Criteria:** App launches on all three platforms with a placeholder home screen

**E1-S2: Configure Supabase Backend**
- Create Supabase project (or configure local development with `supabase init`)
- Run database migration: create `notes` table, `user_preferences` table, indexes, RLS policies, triggers (as defined in architecture doc Section 6.1)
- Create `recordings` storage bucket with private access policies
- Set up environment variables (`.env.local` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- Initialize Supabase client in `services/supabase.ts`
- **Acceptance Criteria:** Supabase client connects successfully; tables exist with RLS enabled; storage bucket is created

**E1-S3: Deploy Edge Function Skeleton**
- Create `process-recording` Edge Function in `supabase/functions/`
- Set up OpenAI API key as Supabase secret
- Implement basic request validation (check for audio file and format_type)
- Return a mock response for now (placeholder transcription and formatted text)
- Deploy to Supabase and verify the function is callable from the client
- **Acceptance Criteria:** Edge Function responds to authenticated POST requests with mock data

---

## E2: Authentication

**Goal:** Users can sign up, log in, maintain sessions, and log out. All data access is scoped to the authenticated user.

**Requirements Covered:** FR-AUTH-01 through FR-AUTH-05, NFR-SEC-04

### Stories

**E2-S1: Implement AuthContext and Session Management**
- Create `AuthContext` with state: `user`, `session`, `loading`
- Implement `supabase.auth.onAuthStateChange` listener
- Implement session persistence (expo-secure-store on mobile, default on web)
- Create auth guard in `app/_layout.tsx` that redirects unauthenticated users to login
- **Acceptance Criteria:** Auth state is globally available; unauthenticated users are redirected to login; sessions persist across app restarts

**E2-S2: Build Login/Signup Screen**
- Create `app/login.tsx` with email and password form
- Toggle between "Sign Up" and "Sign In" modes
- Call `supabase.auth.signUp` and `supabase.auth.signInWithPassword`
- Display validation errors (invalid email, weak password, wrong credentials)
- On successful auth, navigate to Home screen
- **Acceptance Criteria:** User can sign up with email/password; user can sign in; errors are displayed clearly; successful auth navigates to Home

**E2-S3: Implement Logout**
- Add logout button to Settings screen (or Home header temporarily)
- Call `supabase.auth.signOut`
- Clear local state and navigate to Login screen
- **Acceptance Criteria:** User taps logout and is returned to login screen; session is cleared

---

## E3: Voice Recording

**Goal:** Users can record audio with visual feedback, respecting the 5-minute limit. The recording produces an audio file compatible with the Whisper API.

**Requirements Covered:** FR-REC-01 through FR-REC-10

### Stories

**E3-S1: Microphone Permission Handling**
- Request microphone permission using `expo-av` Audio permissions API
- Show explanation if permission is denied with option to open system settings
- Store permission state to avoid re-prompting
- **Acceptance Criteria:** Permission is requested on first recording attempt; denied state shows guidance; granted state proceeds to recording

**E3-S2: Build Recording Screen UI**
- Create `app/record.tsx` as a modal screen
- Display prominent Stop button, Cancel button, and elapsed time timer
- Implement `AudioWaveform` component that visualizes audio metering data
- Style the screen with a focused, distraction-free layout
- **Acceptance Criteria:** Recording screen displays with Stop, Cancel, timer, and waveform; screen is styled and focused

**E3-S3: Implement Audio Recording Logic**
- Use `expo-av` `Audio.Recording` API to capture audio
- Configure recording options for Whisper-compatible format (m4a, 16kHz+ sample rate)
- Start recording on screen mount (after permission check)
- Stop recording on Stop tap, returning the local file URI
- Implement 5-minute maximum duration with auto-stop and user notification
- **Acceptance Criteria:** Audio records successfully and produces a valid file; 5-minute limit enforced; file format is Whisper-compatible

**E3-S4: Implement Cancel Recording**
- Cancel button discards the recording and navigates back to Home
- Stop and unload the recording without saving
- Confirm cancel if recording is longer than 10 seconds
- **Acceptance Criteria:** Cancel discards recording and returns to Home; no audio file is saved

---

## E4: Transcription and Auto-Formatting

**Goal:** Recorded audio is transcribed via Whisper and auto-formatted via GPT through the Edge Function. The result is displayed on a preview screen for user review.

**Requirements Covered:** FR-STT-01 through FR-STT-05, FR-FMT-01 through FR-FMT-10

### Stories

**E4-S1: Implement Edge Function - Whisper Transcription**
- Update `process-recording` Edge Function to accept audio file upload
- Send audio to OpenAI Whisper API (`POST /v1/audio/transcriptions`, model: `whisper-1`)
- Return transcription text
- Handle Whisper API errors (rate limits, invalid audio, network failures)
- **Acceptance Criteria:** Edge Function receives audio and returns accurate transcription; errors return appropriate error responses

**E4-S2: Implement Edge Function - GPT Auto-Formatting**
- Extend `process-recording` to call GPT-4o-mini after transcription
- Implement format-specific prompts for: bullet_list, paragraph, action_items, meeting_notes
- Include title generation in the GPT prompt (return JSON with title + content)
- Parse GPT response and return `{ transcription, formatted_text, title }`
- Handle GPT errors with fallback to raw transcription
- **Acceptance Criteria:** Edge Function returns formatted text for all 4 format types; title is auto-generated; errors fall back to raw transcription

**E4-S3: Implement Client Processing Service**
- Create `services/processing.ts` that sends audio to the Edge Function
- Build multipart/form-data request with audio file and format_type
- Handle response parsing and error cases
- Implement retry logic for network failures
- **Acceptance Criteria:** Client successfully sends audio and receives formatted result; errors are handled with retry option

**E4-S4: Build Note Preview Screen**
- Create `app/preview.tsx` that displays the formatted note after processing
- Show loading overlay during transcription and formatting (with progress text: "Transcribing...", "Formatting...")
- Display formatted text with auto-generated title
- Provide Edit button to modify text before saving
- Provide Save button to persist the note
- Handle errors with retry option or fallback display
- **Acceptance Criteria:** Preview shows formatted note after processing; loading states are clear; user can edit before saving; errors show retry option

---

## E5: Note Management

**Goal:** Notes are persisted to Supabase, displayed in a card grid on the Home screen, and support full CRUD operations.

**Requirements Covered:** FR-NOTE-01 through FR-NOTE-14

### Stories

**E5-S1: Implement NotesContext and CRUD Service**
- Create `NotesContext` with state: `notes[]`, `loading`, `searchQuery`, `filteredNotes[]`
- Create `services/notes.ts` with CRUD operations against Supabase
- Implement `fetchNotes` (ordered by created_at DESC)
- Implement `createNote` (insert with user_id, title, formatted_text, raw_transcription, format_type)
- Implement `updateNote` (update formatted_text, title)
- Implement `deleteNote` (delete by id)
- **Acceptance Criteria:** All CRUD operations work against Supabase; data is scoped to authenticated user via RLS

**E5-S2: Build Home Screen with Note Grid**
- Create `app/index.tsx` as the Home screen
- Implement `NoteGrid` component using FlatList with 2-column layout
- Implement `NoteCard` component showing: title, text preview (truncated to 3 lines), timestamp, `FormatBadge`
- Add `RecordButton` as a floating action button
- Add Settings icon in the header
- Fetch and display notes on mount via NotesContext
- Sort notes newest first
- **Acceptance Criteria:** Home screen displays notes in a card grid; each card shows title, preview, timestamp, format badge; FAB record button and settings icon are present

**E5-S3: Build Note Detail Screen**
- Create `app/note/[id].tsx` for viewing and editing a single note
- Display full formatted text, title, format type, timestamps
- Implement inline text editing (tap to edit formatted text)
- Save button persists changes via `updateNote`
- **Acceptance Criteria:** Tapping a note card navigates to detail view; full note content is displayed; user can edit and save changes

**E5-S4: Implement Note Deletion**
- Add delete button/icon to Note Detail screen
- Show confirmation dialog before deleting
- Call `deleteNote` and navigate back to Home
- Remove deleted note from NotesContext state
- **Acceptance Criteria:** User can delete a note with confirmation; note is removed from database and UI

**E5-S5: Connect Recording Flow to Note Saving**
- Wire up the full flow: Record -> Process -> Preview -> Save
- On Save in Preview screen, call `createNote` with all fields
- Navigate back to Home after save
- New note appears in the grid immediately
- **Acceptance Criteria:** End-to-end flow works: record voice, see formatted preview, save note, note appears in Home grid

---

## E6: Settings and Preferences

**Goal:** Users can select and persist their default format preference. The preference is applied to all new recordings.

**Requirements Covered:** FR-SET-01 through FR-SET-04

### Stories

**E6-S1: Implement PreferencesContext and Service**
- Create `PreferencesContext` with state: `defaultFormat`, `loading`
- Create `services/preferences.ts` with get/set operations against `user_preferences` table
- Load preference on authentication (triggered by AuthContext)
- Default to `bullet_list` if no preference exists
- **Acceptance Criteria:** User's format preference loads on login; defaults to bullet_list for new users; preference persists in Supabase

**E6-S2: Build Settings Screen**
- Create `app/settings.tsx` accessible from Home header
- Display format selector with 4 options: Bullet List, Paragraph, Action Items, Meeting Notes
- Highlight currently selected format
- On selection change, update preference via PreferencesContext
- Include logout button
- **Acceptance Criteria:** Settings screen shows format options; user can change default format; selection persists and applies to next recording; logout button works

---

## E7: Search

**Goal:** Users can search their notes by text content from the Home screen.

**Requirements Covered:** FR-NOTE-12, FR-NOTE-13, NFR-PERF-04

### Stories

**E7-S1: Build Search Bar Component**
- Create `SearchBar` component with text input and clear button
- Add SearchBar to the top of the Home screen
- Wire search query to NotesContext `setSearchQuery`
- Debounce input (300ms) to avoid excessive filtering
- **Acceptance Criteria:** Search bar appears on Home screen; typing updates the search query; clear button resets search

**E7-S2: Implement Note Filtering**
- Implement client-side filtering in NotesContext based on `searchQuery`
- Filter notes where title, formatted_text, or raw_transcription contains the query (case-insensitive)
- Update NoteGrid to display `filteredNotes` when a search query is active
- Show "No results" message when search returns empty
- **Acceptance Criteria:** Notes are filtered in real-time as user types; search matches across title, formatted text, and raw transcription; empty state is handled

---

## E8: Audio Storage (Should Have)

**Goal:** Original audio recordings are stored in Supabase Storage and linked to their notes for potential future playback.

**Requirements Covered:** FR-AUD-01 through FR-AUD-03

### Stories

**E8-S1: Implement Audio Upload Service**
- Create upload function in `services/recording.ts`
- Upload audio file to Supabase Storage bucket `recordings` at path `{user_id}/{note_id}.m4a`
- Return the storage URL after successful upload
- Handle upload errors gracefully (note is still saved without audio URL)
- **Acceptance Criteria:** Audio files upload to correct path in Supabase Storage; URL is returned; upload failure does not block note saving

**E8-S2: Link Audio URL to Notes**
- After successful audio upload, update the note record with `audio_url`
- Upload happens in the background after note save (non-blocking)
- Display audio indicator on NoteCard if audio_url exists
- **Acceptance Criteria:** Notes with uploaded audio have audio_url populated; NoteCard shows audio indicator; upload is non-blocking

---

## E9: Polish and Integration Testing

**Goal:** Ensure the complete flow works end-to-end, fix UI polish issues, add accessibility labels, and verify cross-platform behavior.

**Requirements Covered:** NFR-PERF-01 through NFR-PERF-04, NFR-A11Y-01 through NFR-A11Y-03, NFR-REL-01 through NFR-REL-03

### Stories

**E9-S1: End-to-End Flow Verification**
- Test complete flow on all three platforms: web, iOS, Android
- Verify: sign up, log in, record, transcribe, format, preview, edit, save, browse, search, edit note, delete note, change format preference, log out
- Fix any flow-breaking bugs discovered
- **Acceptance Criteria:** Full user flow works on all three platforms without errors

**E9-S2: Error Handling and Resilience**
- Verify all error scenarios: network failure during processing, API errors, permission denied, session expired
- Ensure retry buttons work correctly
- Verify formatting fallback to raw transcription on GPT error
- Ensure no data loss on failures (local audio preserved)
- **Acceptance Criteria:** All error scenarios are handled gracefully; retry mechanisms work; no data loss

**E9-S3: Accessibility and UI Polish**
- Add accessible labels to all interactive elements
- Verify color contrast meets WCAG AA
- Test with screen reader on iOS (VoiceOver) and Android (TalkBack)
- Polish card grid spacing, typography, and visual consistency
- Ensure responsive layout works on different screen sizes
- **Acceptance Criteria:** All interactive elements have accessible labels; color contrast passes WCAG AA; screen reader navigation works; UI is visually polished and responsive

---

## Dependency Graph

```
E1 (Setup)
├── E2 (Auth)
│   ├── E5 (Note Management)
│   │   └── E7 (Search)
│   ├── E6 (Settings)
│   └── E8 (Audio Storage)
├── E3 (Recording)
│   ├── E4 (Transcription/Formatting)
│   └── E8 (Audio Storage)
└── E4 depends on E1 + E3

E9 (Polish) depends on E1-E7
```

---

*Epics: VoiceKeeper v1.0 (MVP)*
*Created: 2026-03-11*
*Based on: PRD v1.0, Architecture v1.0*
