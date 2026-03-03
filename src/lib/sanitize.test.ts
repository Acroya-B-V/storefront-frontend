import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  // --- Dangerous tags ---
  it('strips <script> tags with content', () => {
    expect(sanitizeHtml('<p>Hi</p><script>alert(1)</script>')).toBe('<p>Hi</p>');
  });

  it('strips <script> tags with attributes', () => {
    expect(sanitizeHtml('<script src="evil.js"></script>')).toBe('');
  });

  it('strips <iframe> tags', () => {
    expect(sanitizeHtml('<iframe src="evil.html"></iframe>')).toBe('');
  });

  it('strips <object> tags', () => {
    expect(sanitizeHtml('<object data="evil.swf"></object>')).toBe('');
  });

  it('strips <embed> tags', () => {
    expect(sanitizeHtml('<embed src="evil.swf">')).toBe('');
  });

  it('strips <form> tags', () => {
    expect(sanitizeHtml('<form action="evil"><input></form>')).toBe('');
  });

  it('strips <base> tags', () => {
    expect(sanitizeHtml('<base href="https://evil.com">')).toBe('');
  });

  it('strips case-insensitive tags', () => {
    expect(sanitizeHtml('<SCRIPT>alert(1)</SCRIPT>')).toBe('');
    expect(sanitizeHtml('<ScRiPt>alert(1)</sCrIpT>')).toBe('');
  });

  // --- Event handlers ---
  it('strips double-quoted event handlers', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
  });

  it('strips single-quoted event handlers', () => {
    expect(sanitizeHtml("<div onclick='alert(1)'>Hi</div>")).toBe('<div>Hi</div>');
  });

  it('strips unquoted event handlers', () => {
    expect(sanitizeHtml('<a onmouseover=alert(1)>click</a>')).toBe('<a>click</a>');
  });

  it('strips HTML entity-encoded quote event handlers', () => {
    const input = '<img src="x" onerror=&quot;alert(1)&quot;>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
  });

  // --- javascript: URIs ---
  it('blocks javascript: URIs in href', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toContain('blocked:');
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).not.toContain('javascript:');
  });

  it('blocks case-insensitive javascript: URIs', () => {
    expect(sanitizeHtml('<a href="JAVASCRIPT:alert(1)">click</a>')).toContain('blocked:');
  });

  // --- data: URIs ---
  it('blocks data:text/html URIs', () => {
    const input = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('blocked:');
    expect(result).not.toContain('data:text/html');
  });

  // --- Safe HTML preserved ---
  it('preserves safe HTML tags', () => {
    const safe = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em></p>';
    expect(sanitizeHtml(safe)).toBe(safe);
  });

  it('preserves <img> tags without event handlers', () => {
    const img = '<img src="photo.jpg" alt="A photo" width="300">';
    expect(sanitizeHtml(img)).toBe(img);
  });

  it('preserves links with normal hrefs', () => {
    const link = '<a href="https://example.com">Visit</a>';
    expect(sanitizeHtml(link)).toBe(link);
  });

  it('preserves data: URIs that are not text/html', () => {
    const img = '<img src="data:image/png;base64,abc123">';
    expect(sanitizeHtml(img)).toBe(img);
  });

  // --- Edge cases ---
  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles plain text', () => {
    expect(sanitizeHtml('Just some text')).toBe('Just some text');
  });

  it('handles multiple dangerous elements', () => {
    const input = '<p>Safe</p><script>bad1</script><p>Also safe</p><iframe src="evil"></iframe>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p><p>Also safe</p>');
  });
});
