import { describe, it, expect } from 'vitest';
import { formatPrice } from './currency';

describe('formatPrice', () => {
  it('formats EUR in Dutch locale', () => {
    expect(formatPrice('23.50', 'EUR', 'nl-NL')).toContain('23,50');
  });

  it('formats EUR in English locale', () => {
    expect(formatPrice('23.50', 'EUR', 'en-GB')).toContain('23.50');
  });

  it('formats zero price', () => {
    expect(formatPrice('0.00', 'EUR', 'nl-NL')).toContain('0,00');
  });

  it('handles whole number strings', () => {
    const result = formatPrice('10', 'EUR', 'nl-NL');
    expect(result).toContain('10,00');
  });

  it('handles GBP currency', () => {
    expect(formatPrice('23.50', 'GBP', 'en-GB')).toContain('£');
  });
});
