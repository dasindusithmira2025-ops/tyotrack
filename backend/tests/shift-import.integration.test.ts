import { describe, expect, it } from 'vitest';
import { parseShiftImportPreview } from '@/lib/shift-import/parser';

describe('Shift import parser', () => {
  it('inherits blank dates and preserves Free rows as day-off shifts', async () => {
    const csv = [
      'worker id,date,day,location,start,end',
      'bob@acme.com,2026-02-17,Tuesday,HQ,09:00,17:00',
      'bob@acme.com,,,HQ,18:00,22:00',
      'bob@acme.com,,,Free,,'
    ].join('\n');

    const prisma = {
      user: {
        findMany: async () => [
          { id: 'user_1', name: 'Bob Worker', email: 'bob@acme.com' }
        ]
      }
    } as any;

    const result = await parseShiftImportPreview(prisma, 'tenant-1', 'schedule.csv', Buffer.from(csv));

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[1].date).toBe('2026-02-17');
    expect(result.rows[2].date).toBe('2026-02-17');
    expect(result.rows[2].isDayOff).toBe(true);
    expect(result.rows[2].startTime).toBeNull();
    expect(result.rows[2].endTime).toBeNull();
  });

  it('returns row-level errors for unknown workers', async () => {
    const csv = [
      'worker id,date,day,location,start,end',
      'unknown@acme.com,2026-02-17,Tuesday,HQ,09:00,17:00'
    ].join('\n');

    const prisma = {
      user: {
        findMany: async () => []
      }
    } as any;

    const result = await parseShiftImportPreview(prisma, 'tenant-1', 'schedule.csv', Buffer.from(csv));

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('UNKNOWN_WORKER');
  });
});
