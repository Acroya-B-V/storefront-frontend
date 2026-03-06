import { describe, it, expect } from 'vitest';
import { safeUrl } from './safe-url';

describe('safeUrl', () => {
  it('allows http URLs', () => {
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  it('allows https URLs', () => {
    expect(safeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('allows mailto links', () => {
    expect(safeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
  });

  it('allows tel links', () => {
    expect(safeUrl('tel:+31612345678')).toBe('tel:+31612345678');
  });

  it('allows relative URLs', () => {
    expect(safeUrl('/some/path')).toBe('/some/path');
  });

  it('blocks javascript: URIs', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
  });

  it('blocks javascript: with mixed case', () => {
    expect(safeUrl('JavaScript:alert(1)')).toBe('#');
  });

  it('blocks data: URIs', () => {
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
  });

  it('blocks vbscript: URIs', () => {
    expect(safeUrl('vbscript:MsgBox("XSS")')).toBe('#');
  });

  it('returns # for empty string', () => {
    expect(safeUrl('')).toBe('#');
  });
});
