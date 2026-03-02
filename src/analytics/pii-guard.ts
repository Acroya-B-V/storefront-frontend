/**
 * PII guard — strips personally identifiable information from analytics events.
 *
 * Every event passes through this before being sent to PostHog.
 * Defensive layer that prevents accidental PII leakage.
 */

const PII_FIELDS = new Set([
  'email',
  'phone',
  'phone_number',
  'first_name',
  'last_name',
  'full_name',
  'name',
  'address',
  'street',
  'house_number',
  'city',
]);

export function stripPII(
  props: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  // Cap recursion to avoid pathological inputs
  const MAX_DEPTH = 4;
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (PII_FIELDS.has(key)) continue;

    // Truncate postal code to prefix (first 4 chars) for geographic analysis
    // without full address resolution
    if (key === 'postal_code' && typeof value === 'string') {
      cleaned[key] = value.slice(0, 4);
      continue;
    }

    // Recurse into nested objects to catch deeply nested PII
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && depth < MAX_DEPTH) {
      cleaned[key] = stripPII(value as Record<string, unknown>, depth + 1);
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}
