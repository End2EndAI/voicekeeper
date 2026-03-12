# Product Brief: VoiceKeeper

## Product Overview

**Product Name:** VoiceKeeper
**Tagline:** Speak it. Keep it. Organized.
**Product Type:** Voice-first note-taking application (mobile + web)

VoiceKeeper is a voice-first note-taking app. Think Google Keep with voice as the primary input mode. Users speak their notes, the app transcribes them using OpenAI Whisper, and automatically formats the transcription into a user-selected structure (bullet list, paragraph, action items, meeting notes, etc.). Notes are saved, searchable, and browsable in a familiar card-based UI.

## Problem Statement

### The Problem

Taking notes during meetings, brainstorming sessions, or on-the-go is friction-heavy. Typing on a phone is slow. Voice memos exist but produce unstructured audio blobs that are hard to search, skim, or act on. Users end up with scattered, unorganized recordings they never revisit.

### Who Has This Problem

- **Professionals** who attend meetings and need quick, structured meeting notes
- **Students** who want to capture lecture highlights without typing
- **On-the-go users** who have ideas while driving, walking, or multitasking
- **Anyone** who prefers speaking over typing but still wants organized, text-based notes

### Current Alternatives and Their Gaps

| Alternative | Gap |
|---|---|
| Google Keep | Voice notes transcribe but produce a raw text dump with no formatting or structure |
| Otter.ai | Focused on long-form meeting transcription, not quick personal notes |
| Apple Voice Memos | Audio only with no transcription, no text, no search |
| Notion AI | Desktop-first, heavy UI, not optimized for quick voice capture |
| Standard notes apps | Typing-first where voice is an afterthought |

## Target Users

### Primary Persona: The Busy Professional

- Age 25-45, knowledge worker
- Attends 3-8 meetings per week
- Needs to capture action items, decisions, and follow-ups quickly
- Values speed and organization over elaborate note-taking features
- Uses phone and laptop interchangeably

### Secondary Persona: The Mobile-First Thinker

- Captures ideas, to-dos, and reminders throughout the day
- Prefers voice input because they are often on the move
- Wants notes organized automatically, not a wall of raw text
- Expects a simple, fast UI (open, record, done)

## Core Value Proposition

**One-tap voice capture that produces instant structured notes.**

VoiceKeeper eliminates the gap between speaking and having organized, actionable text notes. No manual formatting. No post-processing. Speak, and your note is ready.

## Key Features (MVP)

### 1. Voice Recording and Capture
- One-tap record button (prominent, always accessible)
- Visual audio waveform feedback during recording
- Support for short notes (under 1 min) and longer recordings (up to 5 min for MVP)
- Microphone permission handling with clear user guidance

### 2. Speech-to-Text Transcription
- Powered by OpenAI Whisper API
- Near real-time transcription (post-recording for MVP)
- High accuracy across accents and languages (English primary for MVP)
- Clear loading/processing state during transcription

### 3. Auto-Formatting
- User selects a **default format** in settings (persisted preference)
- Can override format per-note before or after recording
- Supported formats for MVP:
  - **Bullet List** key points as bullets
  - **Paragraph** clean prose formatting
  - **Action Items** extracted tasks with checkboxes
  - **Meeting Notes** structured with attendees, decisions, action items sections
- Formatting applied via a lightweight LLM pass (or rule-based for simple formats)

### 4. Note Management
- Card-based note browsing (Google Keep style grid)
- Each note card shows: title (auto-generated), preview text, timestamp, format badge
- Full note view with edit capability
- Delete notes
- Search notes by text content

### 5. User Authentication
- Email/password sign-up and login via Supabase Auth
- Persistent sessions across app restarts
- User-scoped data (each user sees only their notes)

## Technical Direction

| Component | Choice | Rationale |
|---|---|---|
| **Frontend** | React Native (Expo) | Single codebase for iOS, Android, and web |
| **Speech-to-Text** | OpenAI Whisper API | Best-in-class transcription accuracy |
| **Auto-formatting** | OpenAI GPT API (lightweight) | Flexible formatting with natural language understanding |
| **Backend/Database** | Supabase | Auth + Postgres + Realtime + Storage in one BaaS |
| **Audio Storage** | Supabase Storage | Store original audio recordings alongside transcriptions |
| **State Management** | React Context + hooks | Sufficient for MVP complexity |

## User Flows

### Primary Flow: Create a Voice Note

1. User opens app and sees note grid (home screen)
2. Taps prominent Record button
3. Speaks their note (sees audio waveform)
4. Taps Stop and processing indicator appears
5. Audio is sent to Whisper API and transcription returned
6. Transcription is auto-formatted per user selected format
7. Formatted note is displayed and user can edit if needed
8. User taps Save and note appears in grid
9. User returns to home screen

### Secondary Flow: Change Format Preference

1. User opens Settings
2. Selects default format (Bullet List / Paragraph / Action Items / Meeting Notes)
3. Preference is saved and applies to all future recordings
4. User can also change format on individual notes after recording

### Secondary Flow: Browse and Search Notes

1. User opens app and sees card grid of saved notes
2. Can scroll through notes (newest first)
3. Can tap search icon, type query, and see filtered results
4. Taps a note card and sees full note with edit option

## Success Metrics (MVP)

| Metric | Target |
|---|---|
| End-to-end flow works | User can record, transcribe, format, save, and browse |
| Transcription accuracy | Whisper API default quality (no degradation in pipeline) |
| Time to save a note | Under 15 seconds for a 30-second recording |
| Format quality | Auto-formatted output usable without manual editing 80+ percent of the time |
| Cross-platform | Works on iOS, Android, and web via Expo |

## Scope and Boundaries

### In Scope (MVP)
- Voice recording with visual feedback
- Whisper-based transcription
- 4 auto-format types (bullets, paragraph, action items, meeting notes)
- Note CRUD (create, read, update, delete)
- Text search across notes
- Email/password authentication
- Card-based note browsing UI
- Settings page for default format selection

### Out of Scope (Post-MVP)
- Real-time streaming transcription (live captions while speaking)
- Note sharing or collaboration
- Folders, tags, or advanced organization
- Rich text editing
- Offline recording with deferred transcription
- Multi-language support beyond English
- Voice commands or hands-free operation
- Integration with calendar, email, or other apps
- Export to PDF, Word, or other formats
- Note pinning or color coding

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Whisper API latency for longer recordings | Poor UX, user waits too long | Limit MVP to 5-min recordings; show progress indicator; consider chunked processing |
| Auto-formatting produces poor output | User loses trust in the feature | Start with simpler formats; iterate on prompts; allow manual editing |
| Microphone permissions denied or unavailable | Core feature blocked | Clear permission request flow; fallback to text input |
| API costs (Whisper + GPT) scale with usage | Cost overrun | Rate limiting per user; monitor usage; optimize prompt length |
| React Native audio recording reliability | Inconsistent across devices | Use Expo AV (well-tested); thorough device testing |

## Timeline Expectation

This is an MVP build. The goal is a functional, deployable app that demonstrates the core voice to transcribe to format to save loop. Polish, advanced features, and optimizations are deferred to post-MVP iterations.

---

*Product Brief: VoiceKeeper v1.0 (MVP)*
*Created: 2026-03-11*
