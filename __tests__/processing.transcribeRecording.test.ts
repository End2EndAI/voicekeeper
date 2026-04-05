/**
 * Unit tests for transcribeRecording — chunking logic.
 *
 * All external I/O is mocked:
 *   - supabase.auth  → authenticated session
 *   - fetch          → fake Whisper endpoint returning "chunk-<N>"
 *   - expo-file-system/legacy → in-memory file store
 *   - audio-splitter → returns pre-built chunks (web blobs / native temp URIs)
 *   - react-native Platform  → overridable per describe block
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'native' },
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  cacheDirectory: 'cache://',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
}));

jest.mock('../services/audio-splitter', () => ({
  splitAudioWeb: jest.fn(),
  splitAudioNative: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { transcribeRecording } from '../services/processing';
import { splitAudioWeb, splitAudioNative } from '../services/audio-splitter';

// ─── Constants ────────────────────────────────────────────────────────────────

const MB = 1024 * 1024;

// ─── Global fetch mock ────────────────────────────────────────────────────────

let whisperCallCount = 0;
const mockFetch = jest.fn();
const deletedUris: string[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  whisperCallCount = 0;
  deletedUris.length = 0;

  // Default: native
  (Platform as any).OS = 'native';

  // Fake Whisper: each call returns "chunk-1", "chunk-2", …
  mockFetch.mockImplementation(() => {
    whisperCallCount += 1;
    const idx = whisperCallCount;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ transcription: `chunk-${idx}` }),
    });
  });
  global.fetch = mockFetch as any;

  // FileSystem: track deletions
  (FileSystem.deleteAsync as jest.Mock).mockImplementation((uri: string) => {
    deletedUris.push(uri);
    return Promise.resolve();
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('transcribeRecording — small file (≤ 25 MB)', () => {
  it('sends a single request without splitting', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 10 * MB });

    const result = await transcribeRecording('file://recording.m4a');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      transcription: 'chunk-1',
      uncertainTerms: [],
    });
  });
});

describe('transcribeRecording — large file (> 25 MB, native)', () => {
  const EXPECTED_CHUNKS = 3;
  const tempUris = ['cache://chunk-0.m4a', 'cache://chunk-1.m4a', 'cache://chunk-2.m4a'];

  beforeEach(() => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 50 * MB });
    (splitAudioNative as jest.Mock).mockResolvedValue(tempUris);
  });

  it('calls splitAudioNative and sends one request per chunk', async () => {
    await transcribeRecording('file://recording.m4a');

    expect(splitAudioNative).toHaveBeenCalledWith('file://recording.m4a');
    expect(mockFetch).toHaveBeenCalledTimes(EXPECTED_CHUNKS);
  });

  it('concatenates chunk transcriptions in order with a space', async () => {
    const result = await transcribeRecording('file://recording.m4a');

    const expected = Array.from({ length: EXPECTED_CHUNKS }, (_, i) => `chunk-${i + 1}`).join(' ');
    expect(result).toEqual({
      transcription: expected,
      uncertainTerms: [],
    });
  });

  it('deletes all temp files after transcription', async () => {
    await transcribeRecording('file://recording.m4a');

    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(EXPECTED_CHUNKS);
    expect(deletedUris.sort()).toEqual(tempUris.sort());
  });

  it('deletes all temp files even when Whisper throws', async () => {
    let calls = 0;
    mockFetch.mockImplementation(() => {
      calls += 1;
      if (calls === 2) return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'quota exceeded' }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ transcription: `chunk-${calls}` }) });
    });

    await expect(transcribeRecording('file://recording.m4a')).rejects.toThrow();

    // Cleanup must still have run for all temp files
    expect(deletedUris.sort()).toEqual(tempUris.sort());
  });
});

describe('transcribeRecording — large file (> 25 MB, web)', () => {
  const EXPECTED_CHUNKS = 2;
  const fakeBlobs = [
    new Blob(['chunk-a'], { type: 'audio/wav' }),
    new Blob(['chunk-b'], { type: 'audio/wav' }),
  ];

  beforeEach(() => {
    (Platform as any).OS = 'web';
    (splitAudioWeb as jest.Mock).mockResolvedValue(fakeBlobs);

    const originalBlob = new Blob(['x'.repeat(30 * MB)], { type: 'audio/webm' });
    let calls = 0;
    mockFetch.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        // First call is fetch(localUri) to get the blob
        return Promise.resolve({ blob: () => Promise.resolve(originalBlob) });
      }
      const idx = calls - 1; // Whisper call index
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ transcription: `chunk-${idx}` }),
      });
    });
  });

  it('calls splitAudioWeb and sends one Whisper request per chunk', async () => {
    await transcribeRecording('blob:recording');

    expect(splitAudioWeb).toHaveBeenCalled();
    // 1 (blob fetch) + EXPECTED_CHUNKS (Whisper)
    expect(mockFetch).toHaveBeenCalledTimes(1 + EXPECTED_CHUNKS);
  });

  it('concatenates chunk transcriptions in order', async () => {
    const result = await transcribeRecording('blob:recording');

    const expected = Array.from({ length: EXPECTED_CHUNKS }, (_, i) => `chunk-${i + 1}`).join(' ');
    expect(result).toEqual({
      transcription: expected,
      uncertainTerms: [],
    });
  });

  it('does not touch the native filesystem', async () => {
    await transcribeRecording('blob:recording');

    expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
