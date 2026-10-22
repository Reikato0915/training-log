import { describe, it, expect } from 'vitest';
import { daysUntil, expiryMessage } from '../src/token-expiry.js';

describe('token expiry reminder', () => {
  it('counts days to expiry', () => {
    expect(daysUntil('2026-11-21', '2026-10-22')).toBe(30);
    expect(daysUntil('2026-10-22', '2026-10-22')).toBe(0);
    expect(daysUntil('', '2026-10-22')).toBeNull();
  });

  it('stays silent until 30 days before', () => {
    expect(expiryMessage('2026-11-22', '2026-10-22')).toBeNull();
    expect(expiryMessage(undefined, '2026-10-22')).toBeNull();
  });

  it('warns with remaining days, then urgent, then expired', () => {
    expect(expiryMessage('2026-11-21', '2026-10-22')).toEqual({ level: 'soon', text: expect.stringContaining('あと 30 日（11/21）') });
    expect(expiryMessage('2026-10-25', '2026-10-22').level).toBe('urgent');
    expect(expiryMessage('2026-10-22', '2026-10-22').text).toContain('今日');
    expect(expiryMessage('2026-10-01', '2026-10-22').level).toBe('expired');
  });
});
