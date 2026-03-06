const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function safeUrl(url: string): string {
  if (!url) return '#';
  try {
    const parsed = new URL(
      url,
      typeof location !== 'undefined' ? location.origin : 'https://placeholder.invalid',
    );
    if (SAFE_PROTOCOLS.has(parsed.protocol)) return url;
  } catch {
    /* invalid URL */
  }
  return '#';
}
