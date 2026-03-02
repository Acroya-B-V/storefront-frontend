import { describe, it, expect } from 'vitest';
import { stripPII } from './pii-guard';

describe('stripPII', () => {
  it('strips email field', () => {
    const result = stripPII({ email: 'test@test.com', merchant_id: 'foo' });
    expect(result.email).toBeUndefined();
    expect(result.merchant_id).toBe('foo');
  });

  it('strips phone field', () => {
    expect(stripPII({ phone: '+31612345678' }).phone).toBeUndefined();
  });

  it('strips phone_number field', () => {
    expect(stripPII({ phone_number: '+31612345678' }).phone_number).toBeUndefined();
  });

  it('strips name fields', () => {
    const result = stripPII({
      first_name: 'John',
      last_name: 'Doe',
      full_name: 'John Doe',
      name: 'John',
    });
    expect(result.first_name).toBeUndefined();
    expect(result.last_name).toBeUndefined();
    expect(result.full_name).toBeUndefined();
    expect(result.name).toBeUndefined();
  });

  it('strips address fields', () => {
    const result = stripPII({
      address: '123 Main St',
      street: 'Main St',
      house_number: '123',
      city: 'Amsterdam',
    });
    expect(result.address).toBeUndefined();
    expect(result.street).toBeUndefined();
    expect(result.house_number).toBeUndefined();
    expect(result.city).toBeUndefined();
  });

  it('truncates postal_code to prefix', () => {
    expect(stripPII({ postal_code: '1015CJ' }).postal_code).toBe('1015');
  });

  it('handles short postal codes', () => {
    expect(stripPII({ postal_code: '10' }).postal_code).toBe('10');
  });

  it('passes allowed fields through unchanged', () => {
    const input = {
      merchant_id: 'x',
      cart_total: '50.00',
      currency: 'EUR',
      language: 'nl',
      item_count: 3,
    };
    expect(stripPII(input)).toEqual(input);
  });

  it('handles empty object', () => {
    expect(stripPII({})).toEqual({});
  });

  it('strips PII from nested objects', () => {
    const result = stripPII({
      merchant_id: 'x',
      customer: { email: 'test@test.com', name: 'John', id: '123' },
    });
    expect(result.merchant_id).toBe('x');
    const customer = result.customer as Record<string, unknown>;
    expect(customer.email).toBeUndefined();
    expect(customer.name).toBeUndefined();
    expect(customer.id).toBe('123');
  });

  it('truncates postal_code inside nested objects', () => {
    const result = stripPII({
      delivery: { postal_code: '1015CJ', country: 'NL' },
    });
    const delivery = result.delivery as Record<string, unknown>;
    expect(delivery.postal_code).toBe('1015');
    expect(delivery.country).toBe('NL');
  });

  it('caps recursion depth to prevent stack overflow', () => {
    // Build deeply nested object (6 levels, cap is 4)
    const deep: any = { level: 0 };
    let current = deep;
    for (let i = 1; i <= 6; i++) {
      current.nested = { level: i, email: 'leak@test.com' };
      current = current.nested;
    }
    // Should not throw
    const result = stripPII(deep);
    expect(result).toBeDefined();
  });

  it('passes arrays through without recursing into them', () => {
    const result = stripPII({
      items: [{ email: 'test@test.com' }],
    });
    // Arrays are passed through as-is (not recursed)
    expect(Array.isArray(result.items)).toBe(true);
  });
});
