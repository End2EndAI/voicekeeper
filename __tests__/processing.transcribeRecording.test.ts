/**
 * Unit tests for transcribeRecording — chunking logic.
 *
 * All external I/O is mocked:
 *   - supabase.auth  → authenticated session
 *   - fetch          → fake Whisper endpoint returning "chunk-<N>"
 *   - expo-file-system/legacy → in-memory file store
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

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { transcribeRecording } from '../services/processing';

// ─── Constants ────────────────────────────────────────────────────────────────

const MB = 1024 * 1024;
const CHUNK_BYTES = 24 * MB;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a base64 string that represents `bytes` bytes of binary data. */
function makeBase64(bytes: number): string {
  return 'A'.repeat(Math.ceil(bytes / 3) * 4);
}

// ─── In-memory file store ─────────────────────────────────────────────────────

const fileStore: Record<string, string> = {};
const deletedUris: string[] = [];

// ─── Global fetch mock ────────────────────────────────────────────────────────

let whisperCallCount = 0;
const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  whisperCallCount = 0;
  deletedUris.length = 0;
  Object.keys(fileStore).forEach(k => delete fileStore[k]);

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

  // FileSystem: in-memory file store
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation((uri: string, data: string) => {
    fileStore[uri] = data;
    return Promise.resolve();
  });
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation((uri: string) =>
    Promise.resolve(fileStore[uri] ?? '')
  );
  (FileSystem.deleteAsync as jest.Mock).mockImplementation((uri: string) => {
    deletedUris.push(uri);
    delete fileStore[uri];
    return Promise.resolve();
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('transcribeRecording — small file (≤ 25 MB)', () => {
  it('sends a single request without splitting', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 10 * MB });

    const result = await transcribeRecording('file://recording.m4a');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBe('chunk-1');
  });
});

describe('transcribeRecording — large file (> 25 MB, native)', () => {
  // 50 MB → ceil(50/24) = 3 chunks (24 MB + 24 MB + 2 MB)
  const FILE_SIZE = 50 * MB;
  const EXPECTED_CHUNKS = Math.ceil(FILE_SIZE / CHUNK_BYTES); // 3

  beforeEach(() => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: FILE_SIZE });
    fileStore['file://recording.m4a'] = makeBase64(FILE_SIZE);
  });

  it('splits into the correct number of chunks', async () => {
    await transcribeRecording('file://recording.m4a');

    expect(mockFetch).toHaveBeenCalledTimes(EXPECTED_CHUNKS);
  });

  it('concatenates chunk transcriptions in order with a space', async () => {
    const result = await transcribeRecording('file://recording.m4a');

    const expected = Array.from({ length: EXPECTED_CHUNKS }, (_, i) => `chunk-${i + 1}`).join(' ');
    expect(result).toBe(expected);
  });

  it('writes one temp file per chunk then deletes all of them', async () => {
    await transcribeRecording('file://recording.m4a');

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(EXPECTED_CHUNKS);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(EXPECTED_CHUNKS);

    const writtenUris = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.map(
      (c: any[]) => c[0] as string
    );
    expect(deletedUris.sort()).toEqual(writtenUris.sort());
  });

  it('deletes all temp files even when Whisper throws', async () => {
    // Make the second Whisper call fail
    let calls = 0;
    mockFetch.mockImplementation(() => {
      calls += 1;
      if (calls === 2) return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'quota exceeded' }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ transcription: `chunk-${calls}` }) });
    });

    await expect(transcribeRecording('file://recording.m4a')).rejects.toThrow();

    // Cleanup must still have run for all written temp files
    const writtenUris = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.map(
      (c: any[]) => c[0] as string
    );
    expect(writtenUris.length).toBeGreaterThan(0);
    expect(deletedUris.sort()).toEqual(writtenUris.sort());
  });

  it('each chunk is the correct base64 size', async () => {
    await transcribeRecording('file://recording.m4a');

    const charsPerChunk = (CHUNK_BYTES / 3) * 4;
    const chunkSizes = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.map(
      (c: any[]) => (c[1] as string).length
    );

    // All chunks except the last must be exactly charsPerChunk
    chunkSizes.slice(0, -1).forEach(len => expect(len).toBe(charsPerChunk));
    // Last chunk is smaller (the remainder)
    expect(chunkSizes[chunkSizes.length - 1]).toBeLessThan(charsPerChunk);
    // All chunks together re-assemble to the full file
    const totalChars = chunkSizes.reduce((a, b) => a + b, 0);
    expect(totalChars).toBe(makeBase64(FILE_SIZE).length);
  });
});

describe('transcribeRecording — large file (> 25 MB, web)', () => {
  // 30 MB → ceil(30/24) = 2 chunks
  const FILE_SIZE = 30 * MB;
  const EXPECTED_CHUNKS = Math.ceil(FILE_SIZE / CHUNK_BYTES); // 2

  beforeEach(() => {
    (Platform as any).OS = 'web';

    const blob = new Blob(['x'.repeat(FILE_SIZE)], { type: 'audio/webm' });
    let calls = 0;
    mockFetch.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        // First call is fetch(localUri) to get the blob
        return Promise.resolve({ blob: () => Promise.resolve(blob) });
      }
      const idx = calls - 1; // Whisper call index
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ transcription: `chunk-${idx}` }),
      });
    });
  });

  it('splits into the correct number of Whisper calls', async () => {
    await transcribeRecording('blob:recording');

    // 1 (blob fetch) + EXPECTED_CHUNKS (Whisper)
    expect(mockFetch).toHaveBeenCalledTimes(1 + EXPECTED_CHUNKS);
  });

  it('concatenates chunk transcriptions in order', async () => {
    const result = await transcribeRecording('blob:recording');

    const expected = Array.from({ length: EXPECTED_CHUNKS }, (_, i) => `chunk-${i + 1}`).join(' ');
    expect(result).toBe(expected);
  });

  it('does not touch the native filesystem', async () => {
    await transcribeRecording('blob:recording');

    expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
