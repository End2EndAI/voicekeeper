/**
 * Audio file splitter for files exceeding the 25 MB Whisper API limit.
 *
 * Web:    AudioContext → decode to PCM → split → encode as WAV chunks
 * Native: Parse M4A (MP4) container → split at sample boundaries → valid M4A chunks
 */

import * as FileSystem from 'expo-file-system/legacy';

const CHUNK_BYTES = 24 * 1024 * 1024; // 24 MB per chunk (1 MB safety margin)

// ─── Shared helpers ──────────────────────────────────────────────────────────

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    result.set(a, off);
    off += a.length;
  }
  return result;
}

// ─── Web: AudioContext → WAV ─────────────────────────────────────────────────

function encodeWav(pcm: Float32Array, sampleRate: number): Blob {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);

  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buf], { type: 'audio/wav' });
}

export async function splitAudioWeb(blob: Blob): Promise<Blob[]> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const sr = audioBuffer.sampleRate;
    const len = audioBuffer.length;
    const nCh = audioBuffer.numberOfChannels;

    // Mix to mono
    const mono = new Float32Array(len);
    for (let ch = 0; ch < nCh; ch++) {
      const chData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < len; i++) mono[i] += chData[i] / nCh;
    }

    const samplesPerChunk = Math.floor((CHUNK_BYTES - 44) / 2);
    const blobs: Blob[] = [];
    for (let off = 0; off < len; off += samplesPerChunk) {
      blobs.push(encodeWav(mono.slice(off, Math.min(off + samplesPerChunk, len)), sr));
    }
    return blobs;
  } finally {
    await ctx.close();
  }
}

// ─── Native: M4A (MP4) parse & mux ──────────────────────────────────────────

export interface M4AInfo {
  ftyp: Uint8Array;
  timescale: number;
  stsd: Uint8Array;               // complete stsd atom (with header)
  sampleSizes: number[];
  sampleDeltas: { count: number; delta: number }[];
  /** File-level byte offset of each audio sample (computed from stco + stsc + stsz). */
  sampleOffsets: number[];
}

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf', 'udta']);

function readType(d: Uint8Array, pos: number): string {
  return String.fromCharCode(d[pos], d[pos + 1], d[pos + 2], d[pos + 3]);
}

/**
 * Parse an M4A file and extract the metadata needed for splitting.
 * Computes per-sample file offsets from stco + stsc + stsz.
 */
export function parseM4A(data: Uint8Array): M4AInfo {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let ftyp: Uint8Array | undefined;
  let timescale: number | undefined;
  let stsd: Uint8Array | undefined;
  let sampleSizes: number[] | undefined;
  let sampleDeltas: { count: number; delta: number }[] | undefined;
  let chunkOffsets: number[] | undefined;
  let stscEntries: { firstChunk: number; samplesPerChunk: number; descIdx: number }[] | undefined;

  const walk = (start: number, end: number) => {
    let pos = start;
    while (pos + 8 <= end) {
      let size = view.getUint32(pos);
      const type = readType(data, pos + 4);
      let headerSize = 8;

      if (size === 1 && pos + 16 <= end) {
        const hi = view.getUint32(pos + 8);
        const lo = view.getUint32(pos + 12);
        size = hi * 0x100000000 + lo;
        headerSize = 16;
      } else if (size === 0) {
        size = end - pos;
      }
      if (size < headerSize || pos + size > end) break;

      const ds = pos + headerSize; // data start
      const atomEnd = pos + size;

      switch (type) {
        case 'ftyp':
          ftyp = data.slice(pos, atomEnd);
          break;

        case 'mdhd': {
          const ver = data[ds];
          // v0: ver+flags(4) + create(4) + mod(4) + timescale(4)
          // v1: ver+flags(4) + create(8) + mod(8) + timescale(4)
          timescale = view.getUint32(ds + (ver === 0 ? 12 : 20));
          break;
        }

        case 'stsd':
          stsd = data.slice(pos, atomEnd);
          break;

        case 'stsz': {
          const constSz = view.getUint32(ds + 4);
          const count = view.getUint32(ds + 8);
          const sizes: number[] = [];
          if (constSz === 0) {
            for (let i = 0; i < count; i++) sizes.push(view.getUint32(ds + 12 + i * 4));
          } else {
            for (let i = 0; i < count; i++) sizes.push(constSz);
          }
          sampleSizes = sizes;
          break;
        }

        case 'stts': {
          const ec = view.getUint32(ds + 4);
          const d: { count: number; delta: number }[] = [];
          for (let i = 0; i < ec; i++) {
            d.push({ count: view.getUint32(ds + 8 + i * 8), delta: view.getUint32(ds + 12 + i * 8) });
          }
          sampleDeltas = d;
          break;
        }

        case 'stco': {
          const ec = view.getUint32(ds + 4);
          chunkOffsets = [];
          for (let i = 0; i < ec; i++) chunkOffsets.push(view.getUint32(ds + 8 + i * 4));
          break;
        }

        case 'co64': {
          const ec = view.getUint32(ds + 4);
          chunkOffsets = [];
          for (let i = 0; i < ec; i++) {
            const hi = view.getUint32(ds + 8 + i * 8);
            const lo = view.getUint32(ds + 12 + i * 8);
            chunkOffsets.push(hi * 0x100000000 + lo);
          }
          break;
        }

        case 'stsc': {
          const ec = view.getUint32(ds + 4);
          stscEntries = [];
          for (let i = 0; i < ec; i++) {
            stscEntries.push({
              firstChunk: view.getUint32(ds + 8 + i * 12),
              samplesPerChunk: view.getUint32(ds + 12 + i * 12),
              descIdx: view.getUint32(ds + 16 + i * 12),
            });
          }
          break;
        }

        default:
          if (CONTAINERS.has(type)) walk(ds, atomEnd);
          break;
      }
      pos = atomEnd;
    }
  };

  walk(0, data.length);

  if (!ftyp) throw new Error('Invalid M4A: missing ftyp atom');
  if (timescale == null) throw new Error('Invalid M4A: missing mdhd atom');
  if (!stsd) throw new Error('Invalid M4A: missing stsd atom');
  if (!sampleSizes) throw new Error('Invalid M4A: missing stsz atom');
  if (!sampleDeltas) throw new Error('Invalid M4A: missing stts atom');
  if (!chunkOffsets) throw new Error('Invalid M4A: missing stco/co64 atom');
  if (!stscEntries) throw new Error('Invalid M4A: missing stsc atom');

  // Compute per-sample file offsets from stco + stsc + stsz
  const sampleOffsets = computeSampleOffsets(sampleSizes, stscEntries, chunkOffsets);

  return { ftyp, timescale, stsd, sampleSizes, sampleDeltas, sampleOffsets };
}

/**
 * Map each sample to its file-level byte offset using stsc + stco + stsz.
 *
 * stsc tells us how many samples are in each chunk (from stco).
 * Within a chunk, samples are contiguous, so we accumulate sizes.
 */
function computeSampleOffsets(
  sampleSizes: number[],
  stscEntries: { firstChunk: number; samplesPerChunk: number; descIdx: number }[],
  chunkOffsets: number[],
): number[] {
  const offsets: number[] = [];
  let sampleIdx = 0;

  for (let chunkIdx = 0; chunkIdx < chunkOffsets.length && sampleIdx < sampleSizes.length; chunkIdx++) {
    // Find how many samples are in this chunk (stsc uses 1-based chunk indices)
    let samplesInChunk = stscEntries[0].samplesPerChunk;
    for (const entry of stscEntries) {
      if (entry.firstChunk - 1 <= chunkIdx) {
        samplesInChunk = entry.samplesPerChunk;
      } else {
        break;
      }
    }

    let byteOff = chunkOffsets[chunkIdx];
    for (let s = 0; s < samplesInChunk && sampleIdx < sampleSizes.length; s++) {
      offsets.push(byteOff);
      byteOff += sampleSizes[sampleIdx];
      sampleIdx++;
    }
  }

  return offsets;
}

// ─── stts range helper ───────────────────────────────────────────────────────

/** Extract stts entries for samples [startSample, endSample). */
export function sttsForRange(
  allDeltas: { count: number; delta: number }[],
  startSample: number,
  endSample: number,
): { count: number; delta: number }[] {
  const result: { count: number; delta: number }[] = [];
  let idx = 0;
  for (const { count, delta } of allDeltas) {
    const entryEnd = idx + count;
    if (entryEnd <= startSample) { idx = entryEnd; continue; }
    if (idx >= endSample) break;
    const n = Math.min(entryEnd, endSample) - Math.max(idx, startSample);
    if (n > 0) {
      if (result.length > 0 && result[result.length - 1].delta === delta) {
        result[result.length - 1].count += n;
      } else {
        result.push({ count: n, delta });
      }
    }
    idx = entryEnd;
  }
  return result;
}

// ─── M4A muxer (sequential write, no patching) ──────────────────────────────

/**
 * Build a minimal valid M4A file containing the given audio samples.
 *
 * All atom sizes are pre-calculated and the file is written sequentially into
 * a single pre-allocated buffer. The stco offset is computed directly — no
 * byte-search or patching is needed.
 *
 * Atom layout: ftyp | moov(mvhd, trak(tkhd, mdia(mdhd, hdlr, minf(smhd, dinf(dref), stbl(stsd,stts,stsz,stsc,stco))))) | mdat
 */
export function buildM4AFile(
  ftyp: Uint8Array,
  stsd: Uint8Array,
  timescale: number,
  sampleSizes: number[],
  sttsEntries: { count: number; delta: number }[],
  audioData: Uint8Array,
): Uint8Array {
  const n = sampleSizes.length;
  const duration = sttsEntries.reduce((s, e) => s + e.count * e.delta, 0);

  // ── Pre-calculate every atom size (content + 8-byte header) ──

  const sttsSize = 8 + 4 + 4 + sttsEntries.length * 8;
  const stszSize = 8 + 4 + 4 + 4 + n * 4;
  const stscSize = 8 + 4 + 4 + 12;       // one entry
  const stcoSize = 8 + 4 + 4 + 4;        // one entry
  const stblSize = 8 + stsd.length + sttsSize + stszSize + stscSize + stcoSize;

  const smhdSize = 8 + 8;
  const urlSize  = 8 + 4;
  const drefSize = 8 + 4 + 4 + urlSize;
  const dinfSize = 8 + drefSize;
  const minfSize = 8 + smhdSize + dinfSize + stblSize;

  const mdhdSize = 8 + 24;
  const HANDLER_NAME = [83,111,117,110,100,72,97,110,100,108,101,114,0]; // 'SoundHandler\0'
  const hdlrSize = 8 + 4 + 4 + 4 + 12 + HANDLER_NAME.length;
  const mdiaSize = 8 + mdhdSize + hdlrSize + minfSize;

  const tkhdSize = 8 + 84;
  const trakSize = 8 + tkhdSize + mdiaSize;

  const mvhdSize = 8 + 100;
  const moovSize = 8 + mvhdSize + trakSize;

  const mdatSize = 8 + audioData.length;
  const totalSize = ftyp.length + moovSize + mdatSize;

  // stco offset: audio data starts right after ftyp + moov + mdat header (8 bytes)
  const audioOffset = ftyp.length + moovSize + 8;

  // ── Allocate and write sequentially ──

  const out = new Uint8Array(totalSize);
  const dv = new DataView(out.buffer);
  let p = 0;

  // Helper: write atom header (size + fourCC)
  const hdr = (size: number, type: string) => {
    dv.setUint32(p, size); p += 4;
    out[p++] = type.charCodeAt(0);
    out[p++] = type.charCodeAt(1);
    out[p++] = type.charCodeAt(2);
    out[p++] = type.charCodeAt(3);
  };

  // ── ftyp ──
  out.set(ftyp, p); p += ftyp.length;

  // ── moov ──
  hdr(moovSize, 'moov');

  // mvhd (version 0, 100-byte payload)
  hdr(mvhdSize, 'mvhd');
  p += 4;                                   // version+flags
  p += 8;                                   // creation_time + modification_time
  dv.setUint32(p, timescale); p += 4;       // timescale
  dv.setUint32(p, duration);  p += 4;       // duration
  dv.setUint32(p, 0x00010000); p += 4;      // rate = 1.0
  dv.setUint16(p, 0x0100); p += 2;          // volume = 1.0
  p += 10;                                   // reserved
  // identity matrix (36 bytes)
  dv.setUint32(p, 0x00010000); p += 4;      // a
  p += 12;                                   // b, u, c
  dv.setUint32(p, 0x00010000); p += 4;      // d
  p += 12;                                   // v, tx, ty
  dv.setUint32(p, 0x40000000); p += 4;      // w
  p += 24;                                   // pre_defined
  dv.setUint32(p, 2); p += 4;               // next_track_id

  // trak
  hdr(trakSize, 'trak');

  // tkhd (version 0, 84-byte payload)
  hdr(tkhdSize, 'tkhd');
  out[p + 3] = 3; p += 4;                   // version=0, flags=3 (enabled+in_movie)
  p += 8;                                   // creation + modification
  dv.setUint32(p, 1); p += 4;               // track_ID
  p += 4;                                   // reserved
  dv.setUint32(p, duration); p += 4;        // duration
  p += 8;                                   // reserved
  p += 4;                                   // layer + alternate_group
  dv.setUint16(p, 0x0100); p += 2;          // volume
  p += 2;                                   // reserved
  dv.setUint32(p, 0x00010000); p += 4;      // matrix[0]
  p += 12;
  dv.setUint32(p, 0x00010000); p += 4;      // matrix[4]
  p += 12;
  dv.setUint32(p, 0x40000000); p += 4;      // matrix[8]
  p += 8;                                   // width + height

  // mdia
  hdr(mdiaSize, 'mdia');

  // mdhd (version 0, 24-byte payload)
  hdr(mdhdSize, 'mdhd');
  p += 4;                                   // version+flags
  p += 8;                                   // creation + modification
  dv.setUint32(p, timescale); p += 4;       // timescale
  dv.setUint32(p, duration); p += 4;        // duration
  dv.setUint16(p, 0x55C4); p += 2;          // language = 'und'
  p += 2;                                   // pre_defined

  // hdlr
  hdr(hdlrSize, 'hdlr');
  p += 4;                                   // version+flags
  p += 4;                                   // pre_defined
  out[p] = 0x73; out[p+1] = 0x6F; out[p+2] = 0x75; out[p+3] = 0x6E; p += 4; // 'soun'
  p += 12;                                  // reserved
  for (const b of HANDLER_NAME) out[p++] = b;

  // minf
  hdr(minfSize, 'minf');

  // smhd
  hdr(smhdSize, 'smhd');
  p += 8;                                   // version+flags + balance + reserved

  // dinf
  hdr(dinfSize, 'dinf');

  // dref
  hdr(drefSize, 'dref');
  p += 4;                                   // version+flags
  dv.setUint32(p, 1); p += 4;               // entry_count
  // url (self-contained)
  hdr(urlSize, 'url ');
  out[p + 3] = 1; p += 4;                   // version=0, flags=1 (self-contained)

  // stbl
  hdr(stblSize, 'stbl');

  // stsd (copy from original)
  out.set(stsd, p); p += stsd.length;

  // stts
  hdr(sttsSize, 'stts');
  p += 4;                                   // version+flags
  dv.setUint32(p, sttsEntries.length); p += 4;
  for (const e of sttsEntries) {
    dv.setUint32(p, e.count); p += 4;
    dv.setUint32(p, e.delta); p += 4;
  }

  // stsz
  hdr(stszSize, 'stsz');
  p += 4;                                   // version+flags
  p += 4;                                   // sample_size = 0 (variable)
  dv.setUint32(p, n); p += 4;               // sample_count
  for (const sz of sampleSizes) { dv.setUint32(p, sz); p += 4; }

  // stsc (one entry: all samples in one chunk)
  hdr(stscSize, 'stsc');
  p += 4;                                   // version+flags
  dv.setUint32(p, 1); p += 4;               // entry_count
  dv.setUint32(p, 1); p += 4;               // first_chunk
  dv.setUint32(p, n); p += 4;               // samples_per_chunk
  dv.setUint32(p, 1); p += 4;               // sample_description_index

  // stco (one entry: offset to audio data in mdat)
  hdr(stcoSize, 'stco');
  p += 4;                                   // version+flags
  dv.setUint32(p, 1); p += 4;               // entry_count
  dv.setUint32(p, audioOffset); p += 4;     // chunk_offset — pre-calculated, no patching!

  // ── mdat ──
  hdr(mdatSize, 'mdat');
  out.set(audioData, p); p += audioData.length;

  return out;
}

// ─── Native: split M4A into valid chunk files ────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    const slice = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    parts.push(String.fromCharCode.apply(null, Array.from(slice)));
  }
  return btoa(parts.join(''));
}

export async function splitAudioNative(localUri: string): Promise<string[]> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = base64ToBytes(base64);
  const info = parseM4A(data);

  // Group samples into chunks of ≤ CHUNK_BYTES of raw audio data
  const groups: { start: number; end: number }[] = [];
  let grpStart = 0;
  let grpSize = 0;
  for (let i = 0; i < info.sampleSizes.length; i++) {
    if (grpSize + info.sampleSizes[i] > CHUNK_BYTES && grpSize > 0) {
      groups.push({ start: grpStart, end: i });
      grpStart = i;
      grpSize = 0;
    }
    grpSize += info.sampleSizes[i];
  }
  if (grpSize > 0) groups.push({ start: grpStart, end: info.sampleSizes.length });

  // Build a valid M4A file for each group
  const tempUris: string[] = [];

  for (let g = 0; g < groups.length; g++) {
    const { start, end } = groups[g];
    const chunkSampleSizes = info.sampleSizes.slice(start, end);

    // Gather audio bytes using per-sample offsets (handles non-contiguous layouts)
    const firstOff = info.sampleOffsets[start];
    const lastOff = info.sampleOffsets[end - 1];
    const lastSize = info.sampleSizes[end - 1];
    const totalSpan = lastOff + lastSize - firstOff;
    const totalDataSize = chunkSampleSizes.reduce((s, sz) => s + sz, 0);

    let audioBytes: Uint8Array;
    if (totalSpan === totalDataSize) {
      // Contiguous — fast path (single slice)
      audioBytes = data.slice(firstOff, firstOff + totalDataSize);
    } else {
      // Non-contiguous — gather per sample
      audioBytes = new Uint8Array(totalDataSize);
      let dst = 0;
      for (let s = start; s < end; s++) {
        const src = info.sampleOffsets[s];
        const sz = info.sampleSizes[s];
        audioBytes.set(data.subarray(src, src + sz), dst);
        dst += sz;
      }
    }

    const entries = sttsForRange(info.sampleDeltas, start, end);
    const m4aBytes = buildM4AFile(info.ftyp, info.stsd, info.timescale, chunkSampleSizes, entries, audioBytes);

    const tempUri = `${FileSystem.cacheDirectory}chunk-${Date.now()}-${g}.m4a`;
    await FileSystem.writeAsStringAsync(tempUri, bytesToBase64(m4aBytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    tempUris.push(tempUri);
  }

  return tempUris;
}
