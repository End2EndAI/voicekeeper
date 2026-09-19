/**
 * RFC 4122 v4 UUID generator.
 *
 * Notes created offline need a stable primary key before they ever reach
 * Supabase, so the id has to be generated on the device. Uses the platform
 * CSPRNG when the runtime exposes one (web, and native runtimes with a
 * getRandomValues polyfill) and falls back to Math.random otherwise — the
 * fallback is weaker but the value only has to be unique, not unguessable.
 */
export function uuidv4(): string {
  const bytes = new Uint8Array(16);

  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Version 4 + RFC 4122 variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }

  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
