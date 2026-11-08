import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function vientianeDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Vientiane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

@Injectable()
export class VisitorService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(day = vientianeDay()) {
    const date = new Date(`${day}T00:00:00.000Z`);
    const yesterdayDate = new Date(date.getTime() - 86400000);
    const weekStart = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000);
    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const sum = (from: Date) => this.prisma.visitorDaily.aggregate({ where: { date: { gte: from, lte: date } }, _sum: { visits: true } });
    const [today, yesterday, week, month, total] = await Promise.all([
      this.prisma.visitorDaily.findUnique({ where: { date }, select: { visits: true } }),
      this.prisma.visitorDaily.findUnique({ where: { date: yesterdayDate }, select: { visits: true } }),
      sum(weekStart), sum(monthStart),
      this.prisma.visitorDaily.aggregate({ _sum: { visits: true } }),
    ]);
    return { date: day, today: today?.visits ?? 0, yesterday: yesterday?.visits ?? 0, week: week._sum.visits ?? 0, month: month._sum.visits ?? 0, total: total._sum.visits ?? 0 };
  }

  async record() {
    const day = vientianeDay();
    const date = new Date(`${day}T00:00:00.000Z`);
    await this.prisma.visitorDaily.upsert({ where: { date }, create: { date, visits: 1 }, update: { visits: { increment: 1 } } });
    return this.stats(day);
  }
}
