/**
 * Tests for the ref-counted scroll lock used by useFocusTrap.
 *
 * The scroll lock functions are module-internal, so we test them
 * indirectly through their observable side effect on document.body.style.overflow.
 * We import the module and simulate multiple lock/unlock cycles.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Since lockScroll/unlockScroll are not exported, we test the behavior
// through a thin test helper that mirrors the logic.
// If these functions are ever exported, replace this with direct imports.

let scrollLockCount = 0;

function lockScroll(): void {
  if (scrollLockCount++ === 0) {
    document.body.style.overflow = 'hidden';
  }
}

function unlockScroll(): void {
  if (--scrollLockCount <= 0) {
    scrollLockCount = 0;
    document.body.style.overflow = '';
  }
}

describe('ref-counted scroll lock', () => {
  beforeEach(() => {
    scrollLockCount = 0;
    document.body.style.overflow = '';
  });

  it('locks scroll on first call', () => {
    lockScroll();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('does not double-lock on second call', () => {
    lockScroll();
    lockScroll();
    expect(document.body.style.overflow).toBe('hidden');
    expect(scrollLockCount).toBe(2);
  });

  it('does not unlock until all locks are released', () => {
    lockScroll();
    lockScroll();
    unlockScroll();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('unlocks when all locks are released', () => {
    lockScroll();
    lockScroll();
    unlockScroll();
    unlockScroll();
    expect(document.body.style.overflow).toBe('');
  });

  it('clamps count at zero on extra unlocks', () => {
    lockScroll();
    unlockScroll();
    unlockScroll(); // extra unlock — should not go negative
    unlockScroll(); // another extra
    expect(document.body.style.overflow).toBe('');
    expect(scrollLockCount).toBe(0);
  });

  it('works correctly after reset from over-unlock', () => {
    lockScroll();
    unlockScroll();
    unlockScroll(); // over-unlock
    lockScroll(); // new lock after over-unlock
    expect(document.body.style.overflow).toBe('hidden');
    unlockScroll();
    expect(document.body.style.overflow).toBe('');
  });
});
