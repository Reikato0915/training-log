import { describe, it, expect } from 'vitest';
import { TIME_SLOTS, slotForHour, slotLabel, withAutoSlot } from '../src/timeslot.js';

describe('time slots', () => {
  it('offers 2-hour slots from 6 to 22', () => {
    expect(TIME_SLOTS).toEqual(['06-08', '08-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22']);
    expect(slotLabel('18-20')).toBe('18〜20時');
  });

  it('maps the start hour into its slot and clamps outside 6–22', () => {
    expect(slotForHour(6)).toBe('06-08');
    expect(slotForHour(19)).toBe('18-20');
    expect(slotForHour(21)).toBe('20-22');
    expect(slotForHour(4)).toBe('06-08');
    expect(slotForHour(23)).toBe('20-22');
  });

  it('auto-fills only on today and only when not set yet', () => {
    const at19 = new Date(2026, 9, 23, 19, 5);
    expect(withAutoSlot({ date: '2026-10-23' }, '2026-10-23', at19).timeSlot).toBe('18-20');
    expect(withAutoSlot({ date: '2026-10-20' }, '2026-10-23', at19).timeSlot).toBeUndefined();
    expect(withAutoSlot({ date: '2026-10-23', timeSlot: '08-10' }, '2026-10-23', at19).timeSlot).toBe('08-10');
    expect(withAutoSlot({ date: '2026-10-23', timeSlot: null }, '2026-10-23', at19).timeSlot).toBeNull();
  });
});
