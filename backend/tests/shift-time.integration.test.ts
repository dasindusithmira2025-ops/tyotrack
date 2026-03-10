import { describe, expect, it } from 'vitest';
import { computeShiftTimes, deriveWeekMetadata } from '@/lib/shifts/time';

describe('Shift time helpers', () => {
  it('derives the Monday-Sunday week window for a local shift date', () => {
    const week = deriveWeekMetadata('2026-02-19');

    expect(week.weekStartDate).toBe('2026-02-16');
    expect(week.weekEndDate).toBe('2026-02-22');
    expect(week.weekRange).toContain('16.02.2026');
  });

  it('supports overnight shifts and computes a reminder one hour before start', () => {
    const result = computeShiftTimes('2026-02-19', '22:00', '06:00', false);

    expect(result.shiftStartAtUtc?.toISOString()).toBe('2026-02-19T20:00:00.000Z');
    expect(result.shiftEndAtUtc?.toISOString()).toBe('2026-02-20T04:00:00.000Z');
    expect(result.reminderDueAtUtc?.toISOString()).toBe('2026-02-19T19:00:00.000Z');
  });
});
