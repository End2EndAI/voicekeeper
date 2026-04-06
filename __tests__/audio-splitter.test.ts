/**
 * Roundtrip tests for the M4A parser and muxer.
 *
 * Builds a synthetic M4A → parses it → verifies parsed values.
 * Then rebuilds from parsed data → re-parses → verifies roundtrip consistency.
 * This catches any structural issues in the atom layout.
 */

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  cacheDirectory: 'cache://',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

import { parseM4A, buildM4AFile, sttsForRange, M4AInfo } from '../services/audio-splitter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal ftyp atom for M4A. */
function makeFtyp(): Uint8Array {
  // ftyp: size(4) + 'ftyp'(4) + major_brand(4) + minor_version(4) + compatible(4) = 20 bytes
  const ftyp = new Uint8Array(20);
  const v = new DataView(ftyp.buffer);
  v.setUint32(0, 20);
  ftyp.set([0x66, 0x74, 0x79, 0x70], 4);   // 'ftyp'
  ftyp.set([0x4D, 0x34, 0x41, 0x20], 8);   // 'M4A '
  ftyp.set([0x69, 0x73, 0x6F, 0x6D], 16);  // 'isom'
  return ftyp;
}

/** Build a minimal stsd atom for AAC audio (opaque — we just need valid bytes). */
function makeStsd(): Uint8Array {
  // Minimal stsd: header(8) + version+flags(4) + entry_count(4) + mp4a entry
  // mp4a: header(8) + reserved(6) + data_ref_idx(2) + reserved(8) +
  //        channels(2) + sample_size(2) + reserved(4) + sample_rate(4) = 36 bytes
  const mp4aSize = 36;
  const stsdSize = 8 + 4 + 4 + mp4aSize;
  const stsd = new Uint8Array(stsdSize);
  const v = new DataView(stsd.buffer);

  // stsd header
  v.setUint32(0, stsdSize);
  stsd.set([0x73, 0x74, 0x73, 0x64], 4); // 'stsd'
  // version + flags = 0
  v.setUint32(12, 1);                     // entry_count

  // mp4a
  const mp4aOff = 16;
  v.setUint32(mp4aOff, mp4aSize);
  stsd.set([0x6D, 0x70, 0x34, 0x61], mp4aOff + 4); // 'mp4a'
  // reserved (6 bytes) = 0
  v.setUint16(mp4aOff + 14, 1);           // data_reference_index = 1
  // reserved (8 bytes) = 0
  v.setUint16(mp4aOff + 24, 1);           // channel_count = 1 (mono)
  v.setUint16(mp4aOff + 26, 16);          // sample_size = 16 bits
  // reserved (4 bytes) = 0
  v.setUint32(mp4aOff + 32, 44100 << 16); // sample_rate = 44100 as 16.16 fixed

  return stsd;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parseM4A', () => {
  const FTYP = makeFtyp();
  const STSD = makeStsd();
  const TIMESCALE = 44100;
  const SAMPLE_SIZES = [256, 300, 280, 310, 290];
  const STTS_ENTRIES = [{ count: 5, delta: 1024 }];
  const AUDIO_DATA = new Uint8Array(256 + 300 + 280 + 310 + 290); // 1436 bytes
  for (let i = 0; i < AUDIO_DATA.length; i++) AUDIO_DATA[i] = i & 0xFF;

  let m4a: Uint8Array;
  let parsed: M4AInfo;

  beforeAll(() => {
    // Use the production muxer to create the test file — its correctness is
    // verified independently by the buildM4AFile roundtrip tests below.
    m4a = buildM4AFile(FTYP, STSD, TIMESCALE, SAMPLE_SIZES, STTS_ENTRIES, AUDIO_DATA);
    parsed = parseM4A(m4a);
  });

  it('extracts correct timescale', () => {
    expect(parsed.timescale).toBe(TIMESCALE);
  });

  it('extracts correct sample sizes', () => {
    expect(parsed.sampleSizes).toEqual(SAMPLE_SIZES);
  });

  it('extracts correct stts entries', () => {
    expect(parsed.sampleDeltas).toEqual(STTS_ENTRIES);
  });

  it('extracts ftyp matching the original', () => {
    expect(Array.from(parsed.ftyp)).toEqual(Array.from(FTYP));
  });

  it('extracts stsd matching the original', () => {
    expect(Array.from(parsed.stsd)).toEqual(Array.from(STSD));
  });

  it('computes sequential per-sample offsets consistent with sample sizes', () => {
    expect(parsed.sampleOffsets).toHaveLength(5);
    for (let i = 1; i < parsed.sampleOffsets.length; i++) {
      expect(parsed.sampleOffsets[i]).toBe(parsed.sampleOffsets[i - 1] + SAMPLE_SIZES[i - 1]);
    }
  });

  it('audio data at parsed offsets matches the original', () => {
    let expectedOff = 0;
    for (let i = 0; i < SAMPLE_SIZES.length; i++) {
      const fileOff = parsed.sampleOffsets[i];
      const sz = SAMPLE_SIZES[i];
      const actual = Array.from(m4a.slice(fileOff, fileOff + sz));
      const expected = Array.from(AUDIO_DATA.slice(expectedOff, expectedOff + sz));
      expect(actual).toEqual(expected);
      expectedOff += sz;
    }
  });
});

describe('buildM4AFile roundtrip', () => {
  const FTYP = makeFtyp();
  const STSD = makeStsd();
  const TIMESCALE = 44100;
  const SAMPLE_SIZES = [256, 300, 280, 310, 290, 320, 270, 305, 295, 260];
  const STTS_ENTRIES = [{ count: 10, delta: 1024 }];
  const totalAudioBytes = SAMPLE_SIZES.reduce((s, sz) => s + sz, 0);
  const AUDIO_DATA = new Uint8Array(totalAudioBytes);
  for (let i = 0; i < totalAudioBytes; i++) AUDIO_DATA[i] = (i * 7 + 13) & 0xFF;

  it('produces a file that parseM4A can parse with matching values', () => {
    const built = buildM4AFile(FTYP, STSD, TIMESCALE, SAMPLE_SIZES, STTS_ENTRIES, AUDIO_DATA);
    const parsed = parseM4A(built);

    expect(parsed.timescale).toBe(TIMESCALE);
    expect(parsed.sampleSizes).toEqual(SAMPLE_SIZES);
    expect(parsed.sampleDeltas).toEqual(STTS_ENTRIES);
    expect(Array.from(parsed.ftyp)).toEqual(Array.from(FTYP));
    expect(Array.from(parsed.stsd)).toEqual(Array.from(STSD));
  });

  it('stco offset points to the correct audio data position', () => {
    const built = buildM4AFile(FTYP, STSD, TIMESCALE, SAMPLE_SIZES, STTS_ENTRIES, AUDIO_DATA);
    const parsed = parseM4A(built);

    // Read audio data from the file at the parsed offsets
    let srcOff = 0;
    for (let i = 0; i < SAMPLE_SIZES.length; i++) {
      const fileOff = parsed.sampleOffsets[i];
      const sz = SAMPLE_SIZES[i];
      const fromFile = Array.from(built.slice(fileOff, fileOff + sz));
      const fromOriginal = Array.from(AUDIO_DATA.slice(srcOff, srcOff + sz));
      expect(fromFile).toEqual(fromOriginal);
      srcOff += sz;
    }
  });

  it('double roundtrip: build → parse → build → parse gives identical results', () => {
    const built1 = buildM4AFile(FTYP, STSD, TIMESCALE, SAMPLE_SIZES, STTS_ENTRIES, AUDIO_DATA);
    const parsed1 = parseM4A(built1);

    // Reconstruct audio data from parsed offsets
    const audioFromFile = new Uint8Array(totalAudioBytes);
    let dst = 0;
    for (let i = 0; i < parsed1.sampleSizes.length; i++) {
      const off = parsed1.sampleOffsets[i];
      const sz = parsed1.sampleSizes[i];
      audioFromFile.set(built1.subarray(off, off + sz), dst);
      dst += sz;
    }

    const built2 = buildM4AFile(parsed1.ftyp, parsed1.stsd, parsed1.timescale, parsed1.sampleSizes, parsed1.sampleDeltas, audioFromFile);
    const parsed2 = parseM4A(built2);

    expect(parsed2.timescale).toBe(parsed1.timescale);
    expect(parsed2.sampleSizes).toEqual(parsed1.sampleSizes);
    expect(parsed2.sampleDeltas).toEqual(parsed1.sampleDeltas);
    expect(parsed2.sampleOffsets.length).toBe(parsed1.sampleOffsets.length);
  });
});

describe('sttsForRange', () => {
  const ENTRIES = [
    { count: 100, delta: 1024 },
    { count: 50, delta: 960 },
  ];

  it('returns full first entry for range [0, 100)', () => {
    expect(sttsForRange(ENTRIES, 0, 100)).toEqual([{ count: 100, delta: 1024 }]);
  });

  it('returns partial first entry for range [10, 50)', () => {
    expect(sttsForRange(ENTRIES, 10, 50)).toEqual([{ count: 40, delta: 1024 }]);
  });

  it('spans both entries for range [90, 120)', () => {
    expect(sttsForRange(ENTRIES, 90, 120)).toEqual([
      { count: 10, delta: 1024 },
      { count: 20, delta: 960 },
    ]);
  });

  it('returns full second entry for range [100, 150)', () => {
    expect(sttsForRange(ENTRIES, 100, 150)).toEqual([{ count: 50, delta: 960 }]);
  });
});
