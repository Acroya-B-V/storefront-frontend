import { describe, it, expect } from 'vitest';
import { colorStyle } from './comms-theme';

describe('colorStyle', () => {
  it('returns undefined when no colors provided', () => {
    expect(colorStyle({})).toBeUndefined();
    expect(colorStyle({ bg: '', text: '' })).toBeUndefined();
  });

  it('accepts valid 3-char hex', () => {
    expect(colorStyle({ bg: '#f00', text: '' })).toEqual({ backgroundColor: '#f00' });
  });

  it('accepts valid 6-char hex', () => {
    expect(colorStyle({ bg: '#ff0000', text: '#00ff00' })).toEqual({
      backgroundColor: '#ff0000',
      color: '#00ff00',
    });
  });

  it('accepts valid 4-char hex (with alpha)', () => {
    expect(colorStyle({ bg: '#f00f', text: '' })).toEqual({ backgroundColor: '#f00f' });
  });

  it('accepts valid 8-char hex (with alpha)', () => {
    expect(colorStyle({ bg: '#ff000080', text: '' })).toEqual({ backgroundColor: '#ff000080' });
  });

  it('rejects invalid 5-char hex', () => {
    expect(colorStyle({ bg: '#ff000', text: '' })).toBeUndefined();
  });

  it('rejects invalid 7-char hex', () => {
    expect(colorStyle({ bg: '#ff0000f', text: '' })).toBeUndefined();
  });

  it('rejects url() values', () => {
    expect(colorStyle({ bg: 'url(https://evil.com)', text: '' })).toBeUndefined();
  });

  it('rejects expression() values', () => {
    expect(colorStyle({ bg: 'expression(alert(1))', text: '' })).toBeUndefined();
  });

  it('rejects javascript: values', () => {
    expect(colorStyle({ bg: 'javascript:alert(1)', text: '' })).toBeUndefined();
  });
});
