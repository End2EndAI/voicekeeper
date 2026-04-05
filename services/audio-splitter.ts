/**
 * Audio file splitter for files exceeding the 25 MB Whisper API limit.
 *
 * Web:    AudioContext → decode to PCM → split → encode as WAV chunks
 * Native: Parse M4A (MP4) container → split at sample boundaries → valid M4A chunks
 */

import { Platform } from 'react-native';
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
  v.setUint32(16, 16, true);           // fmt chunk size
  v.setUint16(20, 1, true);            // PCM
  v.setUint16(22, 1, true);            // mono
  v.setUint32(24, sampleRate, true);    // sample rate
  v.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  v.setUint16(32, 2, true);            // block align
  v.setUint16(34, 16, true);           // bits per sample
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

    // Max samples per chunk: (CHUNK_BYTES - 44 byte WAV header) / 2 bytes per sample
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

interface M4AInfo {
  ftyp: Uint8Array;
  timescale: number;
  stsd: Uint8Array;               // complete stsd atom (with header)
  sampleSizes: number[];
  sampleDeltas: { count: number; delta: number }[];
  audioDataOffset: number;        // file-level offset of first audio sample
}

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf', 'udta']);

function readType(d: Uint8Array, pos: number): string {
  return String.fromCharCode(d[pos], d[pos + 1], d[pos + 2], d[pos + 3]);
}

function parseM4A(data: Uint8Array): M4AInfo {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const info: Partial<M4AInfo> = {};

  const walk = (start: number, end: number) => {
    let pos = start;
    while (pos + 8 <= end) {
      let size = view.getUint32(pos);
      const type = readType(data, pos + 4);
      let headerSize = 8;

      if (size === 1 && pos + 16 <= end) {
        // 64-bit extended size
        const hi = view.getUint32(pos + 8);
        const lo = view.getUint32(pos + 12);
        size = hi * 0x100000000 + lo;
        headerSize = 16;
      } else if (size === 0) {
        size = end - pos; // atom extends to end of parent
      }
      if (size < headerSize || pos + size > end) break;

      const dataStart = pos + headerSize;
      const atomEnd = pos + size;

      switch (type) {
        case 'ftyp':
          info.ftyp = data.slice(pos, atomEnd);
          break;

        case 'mdhd': {
          // version(1)+flags(3) then fields differ by version
          const ver = data[dataStart];
          //  v0: create(4)+mod(4)+timescale(4)  →  timescale at +12
          //  v1: create(8)+mod(8)+timescale(4)  →  timescale at +20
          const tsOff = ver === 0 ? 12 : 20;
          info.timescale = view.getUint32(dataStart + tsOff);
          break;
        }

        case 'stsd':
          info.stsd = data.slice(pos, atomEnd);
          break;

        case 'stsz': {
          // version+flags(4), sample_size(4), sample_count(4), entries…
          const constantSize = view.getUint32(dataStart + 4);
          const count = view.getUint32(dataStart + 8);
          const sizes: number[] = [];
          if (constantSize === 0) {
            for (let i = 0; i < count; i++) sizes.push(view.getUint32(dataStart + 12 + i * 4));
          } else {
            for (let i = 0; i < count; i++) sizes.push(constantSize);
          }
          info.sampleSizes = sizes;
          break;
        }

        case 'stts': {
          // version+flags(4), entry_count(4), entries(8 each)
          const entryCount = view.getUint32(dataStart + 4);
          const deltas: { count: number; delta: number }[] = [];
          for (let i = 0; i < entryCount; i++) {
            deltas.push({
              count: view.getUint32(dataStart + 8 + i * 8),
              delta: view.getUint32(dataStart + 12 + i * 8),
            });
          }
          info.sampleDeltas = deltas;
          break;
        }

        case 'stco': {
          // version+flags(4), entry_count(4), offsets(4 each)
          const n = view.getUint32(dataStart + 4);
          if (n > 0) info.audioDataOffset = view.getUint32(dataStart + 8);
          break;
        }

        case 'co64': {
          const n = view.getUint32(dataStart + 4);
          if (n > 0) {
            const hi = view.getUint32(dataStart + 8);
            const lo = view.getUint32(dataStart + 12);
            info.audioDataOffset = hi * 0x100000000 + lo;
          }
          break;
        }

        default:
          if (CONTAINERS.has(type)) walk(dataStart, atomEnd);
          break;
      }

      pos = atomEnd;
    }
  };

  walk(0, data.length);

  if (!info.ftyp) throw new Error('Invalid M4A: missing ftyp atom');
  if (info.timescale == null) throw new Error('Invalid M4A: missing mdhd atom');
  if (!info.stsd) throw new Error('Invalid M4A: missing stsd atom');
  if (!info.sampleSizes) throw new Error('Invalid M4A: missing stsz atom');
  if (!info.sampleDeltas) throw new Error('Invalid M4A: missing stts atom');
  if (info.audioDataOffset == null) throw new Error('Invalid M4A: missing stco/co64 atom');

  return info as M4AInfo;
}

// ─── M4A muxer helpers ──────────────────────────────────────────────────────

function buildAtom(type: string, payload: Uint8Array): Uint8Array {
  const atom = new Uint8Array(8 + payload.length);
  new DataView(atom.buffer).setUint32(0, 8 + payload.length);
  atom[4] = type.charCodeAt(0);
  atom[5] = type.charCodeAt(1);
  atom[6] = type.charCodeAt(2);
  atom[7] = type.charCodeAt(3);
  atom.set(payload, 8);
  return atom;
}

/** Extract stts entries for samples [startSample, endSample). */
function sttsForRange(
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

/**
 * Build a minimal valid M4A file containing the given audio samples.
 *
 * Atom layout: ftyp | moov (mvhd, trak(tkhd, mdia(mdhd, hdlr, minf(smhd, dinf, stbl)))) | mdat
 */
function buildM4AFile(
  ftyp: Uint8Array,
  stsd: Uint8Array,
  timescale: number,
  sampleSizes: number[],
  sttsEntries: { count: number; delta: number }[],
  audioData: Uint8Array,
): Uint8Array {
  const n = sampleSizes.length;
  const duration = sttsEntries.reduce((s, e) => s + e.count * e.delta, 0);

  // ── stbl children ──

  // stts: version+flags(4) + entry_count(4) + entries(8 each)
  const sttsP = new Uint8Array(4 + 4 + sttsEntries.length * 8);
  const sttsV = new DataView(sttsP.buffer);
  sttsV.setUint32(4, sttsEntries.length);
  sttsEntries.forEach((e, i) => {
    sttsV.setUint32(8 + i * 8, e.count);
    sttsV.setUint32(12 + i * 8, e.delta);
  });

  // stsz: version+flags(4) + sample_size(4) + count(4) + entries(4 each)
  const stszP = new Uint8Array(4 + 4 + 4 + n * 4);
  const stszV = new DataView(stszP.buffer);
  stszV.setUint32(8, n);
  sampleSizes.forEach((sz, i) => stszV.setUint32(12 + i * 4, sz));

  // stsc: version+flags(4) + entry_count(4) + one entry(12)
  const stscP = new Uint8Array(4 + 4 + 12);
  const stscV = new DataView(stscP.buffer);
  stscV.setUint32(4, 1);
  stscV.setUint32(8, 1);  // first_chunk (1-based)
  stscV.setUint32(12, n); // samples_per_chunk
  stscV.setUint32(16, 1); // sample_description_index

  // stco: version+flags(4) + entry_count(4) + offset(4) — placeholder, patched later
  const stcoP = new Uint8Array(4 + 4 + 4);
  new DataView(stcoP.buffer).setUint32(4, 1);

  const stbl = buildAtom('stbl', concatBytes(
    stsd,
    buildAtom('stts', sttsP),
    buildAtom('stsz', stszP),
    buildAtom('stsc', stscP),
    buildAtom('stco', stcoP),
  ));

  // ── minf ──

  const smhd = buildAtom('smhd', new Uint8Array(8)); // version+flags(4) + balance(2) + reserved(2)

  const urlP = new Uint8Array(4);
  urlP[3] = 1; // self-contained flag
  const drefP = new Uint8Array(8 + 12); // version+flags(4) + count(4) + url atom(12)
  new DataView(drefP.buffer).setUint32(4, 1);
  drefP.set(buildAtom('url ', urlP), 8);

  const minf = buildAtom('minf', concatBytes(
    smhd,
    buildAtom('dinf', buildAtom('dref', drefP)),
    stbl,
  ));

  // ── mdia ──

  // mdhd v0: version+flags(4) + create(4) + mod(4) + timescale(4) + duration(4) + lang(2) + pre(2) = 24
  const mdhdP = new Uint8Array(24);
  const mdhdV = new DataView(mdhdP.buffer);
  mdhdV.setUint32(12, timescale);
  mdhdV.setUint32(16, duration);
  mdhdP[20] = 0x55; mdhdP[21] = 0xC4; // undetermined language

  // hdlr: version+flags(4) + pre_defined(4) + handler_type(4) + reserved(12) + name
  const handlerName = new TextEncoder().encode('SoundHandler\0');
  const hdlrP = new Uint8Array(4 + 4 + 4 + 12 + handlerName.length);
  // handler_type = 'soun' at offset 8
  hdlrP[8] = 0x73; hdlrP[9] = 0x6F; hdlrP[10] = 0x75; hdlrP[11] = 0x6E;
  hdlrP.set(handlerName, 24);

  const mdia = buildAtom('mdia', concatBytes(
    buildAtom('mdhd', mdhdP),
    buildAtom('hdlr', hdlrP),
    minf,
  ));

  // ── trak ──

  // tkhd v0: version+flags(4) + create(4) + mod(4) + trackID(4) + reserved(4)
  //          + duration(4) + reserved(8) + layer(2) + altGroup(2) + volume(2)
  //          + reserved(2) + matrix(36) + width(4) + height(4) = 84
  const tkhdP = new Uint8Array(84);
  const tkhdV = new DataView(tkhdP.buffer);
  tkhdP[3] = 3;                         // flags: enabled + in_movie
  tkhdV.setUint32(12, 1);               // track_ID
  tkhdV.setUint32(20, duration);         // duration
  tkhdV.setUint16(36, 0x0100);          // volume = 1.0
  tkhdV.setUint32(40, 0x00010000);      // matrix[0]
  tkhdV.setUint32(56, 0x00010000);      // matrix[4]
  tkhdV.setUint32(72, 0x40000000);      // matrix[8]

  const trak = buildAtom('trak', concatBytes(buildAtom('tkhd', tkhdP), mdia));

  // ── moov ──

  // mvhd v0: version+flags(4) + create(4) + mod(4) + timescale(4) + duration(4)
  //          + rate(4) + volume(2) + reserved(10) + matrix(36) + pre_defined(24)
  //          + next_track_id(4) = 100
  const mvhdP = new Uint8Array(100);
  const mvhdV = new DataView(mvhdP.buffer);
  mvhdV.setUint32(12, timescale);        // timescale
  mvhdV.setUint32(16, duration);         // duration
  mvhdV.setUint32(20, 0x00010000);      // rate = 1.0
  mvhdV.setUint16(24, 0x0100);          // volume = 1.0
  mvhdV.setUint32(36, 0x00010000);      // matrix[0]
  mvhdV.setUint32(52, 0x00010000);      // matrix[4]
  mvhdV.setUint32(68, 0x40000000);      // matrix[8]
  mvhdV.setUint32(96, 2);               // next_track_id

  const moov = buildAtom('moov', concatBytes(buildAtom('mvhd', mvhdP), trak));

  // ── mdat ──
  const mdat = buildAtom('mdat', audioData);

  // ── Patch stco offset ──
  // Audio data starts at: ftyp.length + moov.length + 8 (mdat atom header)
  const audioOffset = ftyp.length + moov.length + 8;
  // Find 'stco' atom in moov and write the offset
  for (let i = 0; i < moov.length - 20; i++) {
    if (moov[i + 4] === 0x73 && moov[i + 5] === 0x74 &&
        moov[i + 6] === 0x63 && moov[i + 7] === 0x6F) { // 'stco'
      new DataView(moov.buffer, moov.byteOffset).setUint32(i + 16, audioOffset);
      break;
    }
  }

  return concatBytes(ftyp, moov, mdat);
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

  // Group samples into chunks of ≤ CHUNK_BYTES of audio data
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

  // Build a valid M4A file for each group and write to a temp file
  const tempUris: string[] = [];
  let dataOffset = info.audioDataOffset;

  for (let g = 0; g < groups.length; g++) {
    const { start, end } = groups[g];
    const chunkSizes = info.sampleSizes.slice(start, end);
    const chunkDataSize = chunkSizes.reduce((s, sz) => s + sz, 0);
    const audioBytes = data.slice(dataOffset, dataOffset + chunkDataSize);
    dataOffset += chunkDataSize;

    const entries = sttsForRange(info.sampleDeltas, start, end);
    const m4aBytes = buildM4AFile(info.ftyp, info.stsd, info.timescale, chunkSizes, entries, audioBytes);

    const tempUri = `${FileSystem.cacheDirectory}chunk-${Date.now()}-${g}.m4a`;
    await FileSystem.writeAsStringAsync(tempUri, bytesToBase64(m4aBytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    tempUris.push(tempUri);
  }

  return tempUris;
}
