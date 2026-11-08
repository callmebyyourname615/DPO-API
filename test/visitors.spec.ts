import { VisitorService, vientianeDay } from '../src/content/visitor.service';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('visitor statistics', () => {
  it('uses the date in Vientiane at midnight', () => {
    expect(vientianeDay(new Date('2026-11-07T16:59:59.000Z'))).toBe('2026-11-07');
    expect(vientianeDay(new Date('2026-11-07T17:00:00.000Z'))).toBe('2026-11-08');
  });
  it('atomically increments the current day and returns today and total', async () => {
    const prisma = { visitorDaily: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue({ visits: 4 }), aggregate: jest.fn().mockResolvedValue({ _sum: { visits: 12 } }) } };
    const service = new VisitorService(prisma as unknown as PrismaService);
    jest.useFakeTimers().setSystemTime(new Date('2026-11-07T18:00:00.000Z'));
    try {
      await expect(service.record()).resolves.toEqual({ date: '2026-11-08', today: 4, yesterday: 4, week: 12, month: 12, total: 12 });
      expect(prisma.visitorDaily.upsert).toHaveBeenCalledWith({ where: { date: new Date('2026-11-08T00:00:00.000Z') }, create: { date: new Date('2026-11-08T00:00:00.000Z'), visits: 1 }, update: { visits: { increment: 1 } } });
    } finally { jest.useRealTimers(); }
  });
  it('returns zero for an empty database', async () => {
    const prisma = { visitorDaily: { findUnique: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _sum: { visits: null } }) } };
    await expect(new VisitorService(prisma as unknown as PrismaService).stats('2026-11-08')).resolves.toEqual({ date: '2026-11-08', today: 0, yesterday: 0, week: 0, month: 0, total: 0 });
  });
});
