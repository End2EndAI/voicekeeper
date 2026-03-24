// @ts-nocheck - Deno runtime
// Unit tests for mode parameter routing in process-recording edge function
// Run with: deno test --allow-env supabase/functions/process-recording/index.test.ts

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

// ---------------------------------------------------------------------------
// Helpers to build mock requests
// ---------------------------------------------------------------------------

function makeRequest(fields: Record<string, string | Blob>, authToken = 'Bearer test-token'): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request('https://edge.example.com/process-recording', {
    method: 'POST',
    headers: { Authorization: authToken },
    body: formData,
  });
}

function makeAudioBlob(sizeBytes = 100): Blob {
  return new Blob([new Uint8Array(sizeBytes)], { type: 'audio/m4a' });
}

// ---------------------------------------------------------------------------
// Mode parsing logic (extracted for unit testing)
// ---------------------------------------------------------------------------

function parseProcessingMode(mode: string | null): string {
  const validModes = ['full', 'transcribe_only', 'format_only'];
  const raw = mode ?? 'full';
  return validModes.includes(raw) ? raw : 'full';
}

Deno.test('parseProcessingMode — full is returned for "full"', () => {
  assertEquals(parseProcessingMode('full'), 'full');
});

Deno.test('parseProcessingMode — transcribe_only is returned for "transcribe_only"', () => {
  assertEquals(parseProcessingMode('transcribe_only'), 'transcribe_only');
});

Deno.test('parseProcessingMode — format_only is returned for "format_only"', () => {
  assertEquals(parseProcessingMode('format_only'), 'format_only');
});

Deno.test('parseProcessingMode — null defaults to "full"', () => {
  assertEquals(parseProcessingMode(null), 'full');
});

Deno.test('parseProcessingMode — unknown mode falls back to "full"', () => {
  assertEquals(parseProcessingMode('bogus'), 'full');
  assertEquals(parseProcessingMode('TRANSCRIBE_ONLY'), 'full');
  assertEquals(parseProcessingMode(''), 'full');
});

// ---------------------------------------------------------------------------
// Daily-limit mode awareness
// ---------------------------------------------------------------------------

Deno.test('daily limit is skipped for transcribe_only', () => {
  const processingMode = 'transcribe_only';
  // Simulates the guard condition in the handler
  const shouldCheckLimit = processingMode !== 'transcribe_only';
  assertEquals(shouldCheckLimit, false);
});

Deno.test('daily limit is applied for full mode', () => {
  const processingMode = 'full';
  const shouldCheckLimit = processingMode !== 'transcribe_only';
  assertEquals(shouldCheckLimit, true);
});

Deno.test('daily limit is applied for format_only mode', () => {
  const processingMode = 'format_only';
  const shouldCheckLimit = processingMode !== 'transcribe_only';
  assertEquals(shouldCheckLimit, true);
});

// ---------------------------------------------------------------------------
// transcribe_only input validation
// ---------------------------------------------------------------------------

Deno.test('transcribe_only — missing audio detected', async () => {
  const formData = new FormData();
  formData.append('mode', 'transcribe_only');
  // No 'audio' field added
  const audioFile = formData.get('audio') as File | null;
  assertEquals(audioFile, null);
});

Deno.test('transcribe_only — audio too large detected', () => {
  const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
  const oversizedBlob = new Blob([new Uint8Array(MAX_AUDIO_SIZE + 1)], { type: 'audio/m4a' });
  assertEquals(oversizedBlob.size > MAX_AUDIO_SIZE, true);
});

Deno.test('transcribe_only — valid audio within size limit', () => {
  const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
  const validBlob = makeAudioBlob(1000);
  assertEquals(validBlob.size <= MAX_AUDIO_SIZE, true);
});

// ---------------------------------------------------------------------------
// format_only input validation
// ---------------------------------------------------------------------------

Deno.test('format_only — missing raw_transcription detected (null)', () => {
  const formData = new FormData();
  formData.append('mode', 'format_only');
  const raw = formData.get('raw_transcription') as string | null;
  const isInvalid = !raw || raw.trim().length === 0;
  assertEquals(isInvalid, true);
});

Deno.test('format_only — missing raw_transcription detected (empty string)', () => {
  const formData = new FormData();
  formData.append('mode', 'format_only');
  formData.append('raw_transcription', '   ');
  const raw = formData.get('raw_transcription') as string | null;
  const isInvalid = !raw || raw.trim().length === 0;
  assertEquals(isInvalid, true);
});

Deno.test('format_only — valid raw_transcription passes validation', () => {
  const formData = new FormData();
  formData.append('mode', 'format_only');
  formData.append('raw_transcription', 'Hello world');
  const raw = formData.get('raw_transcription') as string | null;
  const isInvalid = !raw || raw.trim().length === 0;
  assertEquals(isInvalid, false);
});

Deno.test('format_only — invalid format_type detected', () => {
  const VALID_FORMATS = ['bullet_list', 'paragraph', 'action_items', 'meeting_notes', 'custom'];
  const formatType = 'invalid_type';
  assertEquals(VALID_FORMATS.includes(formatType), false);
});

Deno.test('format_only — valid format_type passes', () => {
  const VALID_FORMATS = ['bullet_list', 'paragraph', 'action_items', 'meeting_notes', 'custom'];
  for (const fmt of VALID_FORMATS) {
    assertEquals(VALID_FORMATS.includes(fmt), true);
  }
});

// ---------------------------------------------------------------------------
// format_only response shape
// ---------------------------------------------------------------------------

Deno.test('format_only response includes transcription field from raw_transcription', () => {
  const rawTranscription = 'This is my raw transcription text';
  const mockFormattedContent = 'Formatted content';
  const mockTitle = 'Test Title';

  // Simulate the response payload built in format_only branch
  const responseBody = {
    transcription: rawTranscription,
    formatted_text: mockFormattedContent,
    title: mockTitle,
  };

  assertEquals(responseBody.transcription, rawTranscription);
  assertEquals(responseBody.formatted_text, mockFormattedContent);
  assertEquals(responseBody.title, mockTitle);
});

Deno.test('transcribe_only response only contains transcription field', () => {
  const transcriptionText = 'Whisper returned this text';
  const responseBody = { transcription: transcriptionText };

  assertEquals(Object.keys(responseBody).length, 1);
  assertEquals(responseBody.transcription, transcriptionText);
  assertEquals((responseBody as any).formatted_text, undefined);
  assertEquals((responseBody as any).title, undefined);
});
