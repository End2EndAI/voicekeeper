# Product Requirements Document: VoiceKeeper

## 1. Introduction

### 1.1 Purpose

This PRD defines the requirements for VoiceKeeper v1.0 (MVP), a voice-first note-taking application. It translates the product brief into detailed, implementable requirements for the development team.

### 1.2 Product Summary

VoiceKeeper enables users to capture notes by speaking. The app records audio, transcribes it via OpenAI Whisper, auto-formats the text into a user-selected structure, and saves it as a browsable, searchable note. It targets professionals and mobile-first users who need quick, organized notes without typing.

### 1.3 References

- Product Brief: VoiceKeeper v1.0 (MVP), 2026-03-11
- Tech Stack: React Native (Expo), OpenAI Whisper API, OpenAI GPT API, Supabase

## 2. User Personas

### 2.1 Primary: The Busy Professional

- **Demographics:** Age 25-45, knowledge worker
- **Behavior:** Attends 3-8 meetings/week, needs to capture action items and decisions quickly
- **Needs:** Speed, organization, cross-device access
- **Pain Points:** Typing during meetings is disruptive; voice memos are unstructured blobs

### 2.2 Secondary: The Mobile-First Thinker

- **Demographics:** On-the-go individual (commuter, runner, driver)
- **Behavior:** Captures ideas, to-dos, and reminders throughout the day
- **Needs:** One-tap capture, automatic organization, simple UI
- **Pain Points:** Cannot type while moving; raw voice recordings are never revisited

## 3. Functional Requirements

### 3.1 Authentication (FR-AUTH)

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | Users can sign up with email and password via Supabase Auth | Must Have |
| FR-AUTH-02 | Users can log in with email and password | Must Have |
| FR-AUTH-03 | Sessions persist across app restarts (token-based) | Must Have |
| FR-AUTH-04 | Users can log out | Must Have |
| FR-AUTH-05 | All user data is scoped to the authenticated user | Must Have |

### 3.2 Voice Recording (FR-REC)

| ID | Requirement | Priority |
|---|---|---|
| FR-REC-01 | App requests microphone permission on first use with clear guidance | Must Have |
| FR-REC-02 | Home screen displays a prominent, always-accessible Record button | Must Have |
| FR-REC-03 | Tapping Record starts audio capture immediately | Must Have |
| FR-REC-04 | During recording, display a visual audio waveform or level indicator | Must Have |
| FR-REC-05 | During recording, display elapsed time | Must Have |
| FR-REC-06 | Tapping Stop ends the recording | Must Have |
| FR-REC-07 | Maximum recording duration is 5 minutes for MVP | Must Have |
| FR-REC-08 | Auto-stop recording at 5-minute limit with user notification | Should Have |
| FR-REC-09 | Audio is captured in a format compatible with Whisper API (m4a, mp3, wav, or webm) | Must Have |
| FR-REC-10 | User can cancel a recording in progress (discard without saving) | Should Have |

### 3.3 Transcription (FR-STT)

| ID | Requirement | Priority |
|---|---|---|
| FR-STT-01 | After recording stops, audio is sent to OpenAI Whisper API for transcription | Must Have |
| FR-STT-02 | Display a loading/processing indicator during transcription | Must Have |
| FR-STT-03 | Transcription result is displayed to the user | Must Have |
| FR-STT-04 | Handle transcription errors gracefully with user-facing error message | Must Have |
| FR-STT-05 | English is the primary supported language | Must Have |

### 3.4 Auto-Formatting (FR-FMT)

| ID | Requirement | Priority |
|---|---|---|
| FR-FMT-01 | After transcription, text is auto-formatted per the user's selected format | Must Have |
| FR-FMT-02 | Supported formats: Bullet List, Paragraph, Action Items, Meeting Notes | Must Have |
| FR-FMT-03 | Bullet List format extracts key points as a bulleted list | Must Have |
| FR-FMT-04 | Paragraph format produces clean, readable prose | Must Have |
| FR-FMT-05 | Action Items format extracts tasks with checkboxes | Must Have |
| FR-FMT-06 | Meeting Notes format structures content with sections (topics, decisions, action items) | Must Have |
| FR-FMT-07 | Formatting is performed via OpenAI GPT API with appropriate prompts | Must Have |
| FR-FMT-08 | Display a loading indicator during formatting | Must Have |
| FR-FMT-09 | User can change format for a specific note after recording (re-format) | Should Have |
| FR-FMT-10 | Handle formatting errors gracefully; fall back to raw transcription | Must Have |

### 3.5 Note Management (FR-NOTE)

| ID | Requirement | Priority |
|---|---|---|
| FR-NOTE-01 | After formatting, the note is displayed for user review with option to edit | Must Have |
| FR-NOTE-02 | User can edit the formatted text before saving | Must Have |
| FR-NOTE-03 | User taps Save to persist the note | Must Have |
| FR-NOTE-04 | Each note stores: title (auto-generated), formatted text, raw transcription, format type, created timestamp, updated timestamp | Must Have |
| FR-NOTE-05 | Notes are stored in Supabase Postgres, scoped to the authenticated user | Must Have |
| FR-NOTE-06 | Home screen displays notes in a card grid layout (Google Keep style) | Must Have |
| FR-NOTE-07 | Each card shows: auto-generated title, text preview (truncated), timestamp, format type badge | Must Have |
| FR-NOTE-08 | Notes are sorted by creation date, newest first | Must Have |
| FR-NOTE-09 | Tapping a note card opens the full note view | Must Have |
| FR-NOTE-10 | Full note view supports editing the text content | Must Have |
| FR-NOTE-11 | User can delete a note (with confirmation) | Must Have |
| FR-NOTE-12 | User can search notes by text content | Must Have |
| FR-NOTE-13 | Search filters the note grid in real-time as the user types | Should Have |
| FR-NOTE-14 | Auto-generate a title from the first line or key phrase of the transcription | Must Have |

### 3.6 Settings (FR-SET)

| ID | Requirement | Priority |
|---|---|---|
| FR-SET-01 | Settings screen accessible from home screen (gear icon or menu) | Must Have |
| FR-SET-02 | User can select a default format: Bullet List, Paragraph, Action Items, or Meeting Notes | Must Have |
| FR-SET-03 | Default format preference is persisted (Supabase or local storage) | Must Have |
| FR-SET-04 | Selected format applies to all new recordings until changed | Must Have |

### 3.7 Audio Storage (FR-AUD)

| ID | Requirement | Priority |
|---|---|---|
| FR-AUD-01 | Original audio recordings are uploaded to Supabase Storage | Should Have |
| FR-AUD-02 | Audio files are linked to their corresponding note record | Should Have |
| FR-AUD-03 | Audio files are scoped to the authenticated user (private buckets) | Should Have |

## 4. Non-Functional Requirements

### 4.1 Performance (NFR-PERF)

| ID | Requirement | Target |
|---|---|---|
| NFR-PERF-01 | Time from Stop to displaying formatted note | Under 15 seconds for a 30-second recording |
| NFR-PERF-02 | App startup to interactive home screen | Under 3 seconds |
| NFR-PERF-03 | Note grid scrolls smoothly with 100+ notes | 60fps on mid-range devices |
| NFR-PERF-04 | Search results appear as user types | Under 300ms latency |

### 4.2 Reliability (NFR-REL)

| ID | Requirement |
|---|---|
| NFR-REL-01 | Recording does not drop audio due to app state changes (backgrounding on mobile) |
| NFR-REL-02 | Network errors during transcription/formatting show clear retry option |
| NFR-REL-03 | Failed API calls do not result in data loss (audio is preserved locally until upload succeeds) |

### 4.3 Security (NFR-SEC)

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All API keys (OpenAI) are stored server-side or in environment variables, never in client code |
| NFR-SEC-02 | Supabase Row Level Security (RLS) enforces user data isolation |
| NFR-SEC-03 | Audio storage buckets enforce per-user access policies |
| NFR-SEC-04 | Authentication tokens are stored securely (SecureStore on mobile, httpOnly cookies on web) |

### 4.4 Compatibility (NFR-COMPAT)

| ID | Requirement |
|---|---|
| NFR-COMPAT-01 | iOS 15+ support |
| NFR-COMPAT-02 | Android 10+ support |
| NFR-COMPAT-03 | Modern web browsers (Chrome, Safari, Firefox, Edge - latest 2 versions) |
| NFR-COMPAT-04 | Responsive layout for phone and tablet screen sizes |

### 4.5 Accessibility (NFR-A11Y)

| ID | Requirement |
|---|---|
| NFR-A11Y-01 | All interactive elements have accessible labels |
| NFR-A11Y-02 | Sufficient color contrast ratios (WCAG AA) |
| NFR-A11Y-03 | Screen reader compatible navigation |

## 5. User Interface Requirements

### 5.1 Screens

| Screen | Description |
|---|---|
| **Login/Signup** | Email + password form with toggle between login and signup modes |
| **Home (Note Grid)** | Card grid of saved notes, search bar at top, prominent Record FAB button, settings icon |
| **Recording** | Full-screen or modal overlay with waveform, timer, Stop button, Cancel option |
| **Processing** | Loading state showing transcription and formatting progress |
| **Note Preview** | Displays formatted note after processing; Edit and Save buttons |
| **Note Detail** | Full note view with edit capability, delete option, format type display |
| **Settings** | Default format selector, logout button |

### 5.2 Navigation

- Tab-less, stack-based navigation
- Home is the root screen after authentication
- Record triggers a modal/overlay from Home
- Note Detail is pushed onto the stack from Home
- Settings is accessible from Home header

### 5.3 Design Principles

- **Voice-first:** The Record button is the most prominent UI element
- **Minimal friction:** Fewest possible taps from open to saved note
- **Clean and scannable:** Card grid enables quick visual scanning of notes
- **Familiar patterns:** Google Keep-style layout that users already understand

## 6. Data Model

### 6.1 Users Table (managed by Supabase Auth)

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key, from Supabase Auth |
| email | string | User email |
| created_at | timestamp | Account creation time |

### 6.2 Notes Table

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users, indexed |
| title | string | Auto-generated from transcription |
| formatted_text | text | The auto-formatted note content |
| raw_transcription | text | Original Whisper transcription |
| format_type | enum | bullet_list, paragraph, action_items, meeting_notes |
| audio_url | string (nullable) | URL to audio file in Supabase Storage |
| created_at | timestamp | Note creation time, indexed |
| updated_at | timestamp | Last edit time |

### 6.3 User Preferences Table

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users, unique |
| default_format | enum | bullet_list, paragraph, action_items, meeting_notes |
| updated_at | timestamp | Last preference change |

## 7. API Integration

### 7.1 OpenAI Whisper API

- **Endpoint:** POST /v1/audio/transcriptions
- **Model:** whisper-1
- **Input:** Audio file (m4a, mp3, wav, or webm)
- **Output:** Transcribed text
- **Note:** API calls should be proxied through a backend function (Supabase Edge Function) to protect the API key

### 7.2 OpenAI GPT API (Formatting)

- **Endpoint:** POST /v1/chat/completions
- **Model:** gpt-5-nano (cost-efficient for formatting)
- **Input:** Raw transcription + format type instruction
- **Output:** Formatted text
- **Note:** Proxied through Supabase Edge Function alongside Whisper call

### 7.3 Supabase Edge Functions

Two edge functions needed:

1. **transcribe-audio** - Receives audio, calls Whisper API, returns transcription
2. **format-note** - Receives transcription + format type, calls GPT API, returns formatted text

These can optionally be combined into a single **process-recording** function that chains both steps.

## 8. Scope Boundaries

### 8.1 Explicitly Out of Scope for MVP

- Real-time streaming transcription
- Note sharing or collaboration
- Folders, tags, or categories
- Rich text editing (bold, italic, etc.)
- Offline mode
- Multi-language support
- Voice commands
- Third-party integrations
- Export functionality
- Note pinning or color coding

### 8.2 Future Considerations

These items are documented for post-MVP planning but must not influence MVP architecture decisions beyond ensuring the data model does not preclude them:

- Folder/tag organization (notes table could later add a tags JSONB column)
- Offline recording with sync (local-first architecture consideration)
- Real-time transcription (streaming Whisper or alternative provider)
- Note sharing (additional permissions model)

## 9. Success Criteria

The MVP is considered complete when:

1. A user can sign up, log in, and maintain a session
2. A user can record audio up to 5 minutes
3. The audio is transcribed via Whisper with the result displayed
4. The transcription is auto-formatted into the user's selected format
5. The formatted note is saved to Supabase and appears in the note grid
6. The user can browse, search, view, edit, and delete notes
7. The user can change their default format in settings
8. The app works on iOS, Android, and web via Expo
9. Auto-formatted output is usable without manual editing at least 80% of the time

## 10. Technical Constraints

| Constraint | Detail |
|---|---|
| Whisper API file size limit | 25 MB per request (5-min recording is well under this) |
| Whisper API supported formats | flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm |
| GPT API token limits | gpt-5-nano supports 128K context (more than sufficient) |
| Supabase free tier limits | 500 MB database, 1 GB storage, 50K Edge Function invocations/month |
| React Native audio | Expo AV handles recording; expo-file-system for file management |
| Minimum recording quality | 16kHz sample rate recommended for Whisper accuracy |

## 11. Release Criteria

- All Must Have requirements implemented and tested
- No critical or high-severity bugs
- Core user flow (record, transcribe, format, save, browse) works end-to-end on all three platforms
- Authentication and data isolation verified
- API keys properly secured (not exposed in client)

---

*PRD: VoiceKeeper v1.0 (MVP)*
*Created: 2026-03-11*
*Based on: Product Brief v1.0*
