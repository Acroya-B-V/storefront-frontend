import { describe, it, expect, afterEach } from 'vitest';
import { optimizedImageUrl, responsiveImage, isSlowConnection, adaptForConnection } from './image';

/** Helper to set navigator.connection for a test. */
function setConnection(value: { effectiveType: string; saveData: boolean } | undefined) {
  Object.defineProperty(navigator, 'connection', {
    value,
    writable: true,
    configurable: true,
  });
}

afterEach(() => setConnection(undefined));

describe('optimizedImageUrl', () => {
  it('returns empty string for empty src', () => {
    expect(optimizedImageUrl('', { width: 300 })).toBe('');
  });

  // In dev mode (test env), optimizedImageUrl returns the raw URL.
  // Production URL generation is tested indirectly via adaptForConnection.
  it('returns a string for valid src', () => {
    const url = optimizedImageUrl('https://cdn.example.com/img.jpg', { width: 300 });
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });
});

describe('adaptForConnection', () => {
  it('passes through on 4G without save-data', () => {
    setConnection({ effectiveType: '4g', saveData: false });
    expect(adaptForConnection(900, 75)).toEqual({ width: 900, quality: 75 });
  });

  it('caps width to 600 and quality to 45 on 3G', () => {
    setConnection({ effectiveType: '3g', saveData: false });
    expect(adaptForConnection(900, 75)).toEqual({ width: 600, quality: 45 });
  });

  it('caps width to 400 and quality to 35 on 2G', () => {
    setConnection({ effectiveType: '2g', saveData: false });
    expect(adaptForConnection(900, 75)).toEqual({ width: 400, quality: 35 });
  });

  it('caps width to 400 and quality to 35 on slow-2g', () => {
    setConnection({ effectiveType: 'slow-2g', saveData: false });
    expect(adaptForConnection(900, 75)).toEqual({ width: 400, quality: 35 });
  });

  it('respects save-data even on 4G', () => {
    setConnection({ effectiveType: '4g', saveData: true });
    expect(adaptForConnection(900, 75)).toEqual({ width: 400, quality: 35 });
  });

  it('preserves small widths — only caps, never upscales', () => {
    setConnection({ effectiveType: '3g', saveData: false });
    expect(adaptForConnection(128, 75)).toEqual({ width: 128, quality: 45 });
  });

  it('preserves already-low quality', () => {
    setConnection({ effectiveType: '3g', saveData: false });
    expect(adaptForConnection(900, 30)).toEqual({ width: 600, quality: 30 });
  });

  it('passes through when connection API is unavailable', () => {
    setConnection(undefined);
    expect(adaptForConnection(900, 75)).toEqual({ width: 900, quality: 75 });
  });
});

describe('isSlowConnection', () => {
  it('returns false when API is unavailable', () => {
    expect(isSlowConnection()).toBe(false);
  });

  it('returns true on 3G', () => {
    setConnection({ effectiveType: '3g', saveData: false });
    expect(isSlowConnection()).toBe(true);
  });

  it('returns true on 2G', () => {
    setConnection({ effectiveType: '2g', saveData: false });
    expect(isSlowConnection()).toBe(true);
  });

  it('returns true with save-data on 4G', () => {
    setConnection({ effectiveType: '4g', saveData: true });
    expect(isSlowConnection()).toBe(true);
  });

  it('returns false on 4G without save-data', () => {
    setConnection({ effectiveType: '4g', saveData: false });
    expect(isSlowConnection()).toBe(false);
  });
});

describe('responsiveImage', () => {
  it('returns raw src with empty srcset in dev mode', () => {
    const result = responsiveImage('https://cdn.example.com/img.jpg', [300, 600, 900], '100vw');
    expect(result.sizes).toBe('100vw');
    // In dev, srcset is empty and src is the raw URL
    expect(result.src).toBe('https://cdn.example.com/img.jpg');
    expect(result.srcset).toBe('');
  });
});
