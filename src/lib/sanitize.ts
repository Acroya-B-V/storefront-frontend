/**
 * HTML sanitizer — strips dangerous tags and attributes from CMS content.
 *
 * Defense-in-depth layer: CMS content comes from a trusted backend, but we
 * strip known XSS vectors anyway in case the backend is compromised or
 * an admin pastes malicious content.
 *
 * This is a best-effort regex sanitizer. For untrusted user input, use a
 * proper DOM-based sanitizer like DOMPurify instead.
 */

// Tags that can execute scripts or load external content
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'base'];

// Build one regex per tag — matches:
// 1. Content-bearing tags: <tag ...>...</tag> (case-insensitive close)
// 2. Self-closing tags: <tag ... /> or <tag ...>
const TAG_PATTERNS = DANGEROUS_TAGS.flatMap((tag) => [
  // Content-bearing: <tag ...>...</tag>
  new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'),
  // Self-closing or unclosed: <tag ... /> or <tag ...>
  new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'),
]);

// Event handler attributes: on* = "..." or on* = '...' or on* = value
// Handles HTML entity-encoded quotes (&quot; &#34; &#x22; etc.)
const EVENT_HANDLER_QUOTED =
  /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|&quot;[^&]*&quot;|&#34;[^&]*&#34;|&#x22;[^&]*&#x22;)/gi;
const EVENT_HANDLER_UNQUOTED = /\son\w+\s*=\s*[^\s>"']+/gi;

// javascript: URIs — handles whitespace/entities between "javascript" and ":"
const JS_URI = /javascript\s*:/gi;

// data: URIs that can execute scripts
const DATA_URI = /data\s*:\s*text\/html/gi;

export function sanitizeHtml(html: string): string {
  let result = html;

  // Strip dangerous tags
  for (const pattern of TAG_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Strip event handlers (both quoted and unquoted)
  result = result.replace(EVENT_HANDLER_QUOTED, '');
  result = result.replace(EVENT_HANDLER_UNQUOTED, '');

  // Neutralize javascript: and data:text/html URIs
  result = result.replace(JS_URI, 'blocked:');
  result = result.replace(DATA_URI, 'blocked:text/html');

  return result;
}
