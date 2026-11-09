import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import Bowser = require('bowser');
import { PrismaService } from '../prisma/prisma.service';
import { VisitorEventDto, VisitorReportQueryDto } from '../common/dto/analytics.dto';
import { vientianeDay } from './visitor.service';
import { VisitorGeoService } from './visitor-geo.service';

const DAY = 86400000;
const counts = Prisma.sql`COUNT(*)::int AS views, COUNT(DISTINCT "visitorHash")::int AS visitors, COUNT(DISTINCT "sessionId")::int AS sessions`;
type Counts = { views: number; visitors: number; sessions: number };
type Group = Counts & { key: string; title?: string };
type EventRow = { id: string; visitor: string; path: string; title: string; country: string; device: string; browser: string; os: string; source: string; occurredAt: Date };

export function reportRange(query: VisitorReportQueryDto, now = new Date()) {
  const today = vientianeDay(now);
  const oldest = new Date(`${today}T00:00:00Z`); oldest.setUTCDate(oldest.getUTCDate() - 89);
  const to = query.to || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || !Number.isFinite(new Date(`${to}T00:00:00Z`).valueOf())) throw new BadRequestException('Invalid end date');
  const from = query.from || new Date(new Date(`${to}T00:00:00Z`).getTime() - 6 * DAY).toISOString().slice(0, 10);
  const start = new Date(`${from}T00:00:00+07:00`), endDay = new Date(`${to}T00:00:00+07:00`);
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(endDay.valueOf()) || vientianeDay(start) !== from || vientianeDay(endDay) !== to || from > to || to > today || from < oldest.toISOString().slice(0,10)) throw new BadRequestException('Choose a valid date range within the last 90 days');
  const end = new Date(endDay.getTime() + DAY);
  return { from, to, start, end, previousStart: new Date(start.getTime() - (end.getTime() - start.getTime())), oldest: oldest.toISOString().slice(0,10) };
}

export function visitorAgent(userAgent: string) {
  const parsed = Bowser.parse(userAgent.slice(0,1000));
  return {
    device: ['desktop','mobile','tablet'].includes(parsed.platform.type || '') ? parsed.platform.type! : 'unknown',
    browser: (parsed.browser.name || 'Unknown').slice(0,32),
    os: (parsed.os.name || 'Unknown').slice(0,32),
  };
}

export function referrerHost(referrer: string) {
  try {
    const url = new URL(referrer);
    if (!['http:','https:'].includes(url.protocol)) return 'Direct';
    return url.hostname.toLowerCase().slice(0,253);
  } catch { return 'Direct'; }
}

@Injectable()
export class VisitorAnalyticsService implements OnModuleInit, OnModuleDestroy {
  private cleanup?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(VisitorAnalyticsService.name);
  constructor(private readonly prisma: PrismaService, private readonly geo: VisitorGeoService) {}
  async onModuleInit() {
    await this.prune();
    this.cleanup = setInterval(() => { void this.prune().catch(() => this.logger.warn('Visitor detail retention cleanup failed; it will retry next hour.')); }, 3600000);
    this.cleanup.unref();
  }
  onModuleDestroy() { if (this.cleanup) clearInterval(this.cleanup); }
  async prune(now = new Date()) {
    const cutoff = new Date(`${vientianeDay(new Date(now.getTime() - 89 * DAY))}T00:00:00+07:00`);
    const day = new Date(`${vientianeDay(cutoff)}T00:00:00Z`);
    await this.prisma.$transaction([
      this.prisma.visitorEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } }),
      this.prisma.visitorIdentityDay.deleteMany({ where: { date: { lt: day } } }),
      this.prisma.visitorSessionDay.deleteMany({ where: { date: { lt: day } } }),
    ]);
  }
  async record(dto: VisitorEventDto, request: Request) {
    const ua = request.get('user-agent') || '';
    if (/bot|crawler|spider|headless|preview|facebookexternalhit|monitoring/i.test(ua)) return { accepted: false };
    const visitorHash = createHmac('sha256', process.env.ANALYTICS_HASH_SECRET || process.env.JWT_SECRET!).update(dto.visitorId).digest('hex');
    const country = this.geo.country(request);
    const agent = visitorAgent(ua);
    const occurredAt = new Date();
    const day = vientianeDay(occurredAt);
    const source = referrerHost(dto.referrer);
    // One SQL statement makes duplicate event IDs and daily distinct counters atomic.
    const result = await this.prisma.$queryRaw<{ accepted: boolean }[]>(Prisma.sql`
      WITH inserted AS (
        INSERT INTO "VisitorEvent" (id,"visitorHash","sessionId",path,title,country,device,browser,os,source,"occurredAt")
        VALUES (${dto.id}::uuid,${visitorHash},${dto.sessionId}::uuid,${dto.path},${dto.title},${country},${agent.device},${agent.browser},${agent.os},${source},(${occurredAt}::timestamptz AT TIME ZONE 'UTC'))
        ON CONFLICT (id) DO NOTHING RETURNING id
      ), visitor AS (
        INSERT INTO "VisitorIdentityDay" (date,"visitorHash") SELECT ${day}::date,${visitorHash} FROM inserted
        ON CONFLICT DO NOTHING RETURNING date
      ), session AS (
        INSERT INTO "VisitorSessionDay" (date,"sessionId") SELECT ${day}::date,${dto.sessionId}::uuid FROM inserted
        ON CONFLICT DO NOTHING RETURNING date
      ), aggregate AS (
        INSERT INTO "VisitorAnalyticsDay" (date,views,visitors,sessions)
        SELECT ${day}::date,1,(SELECT COUNT(*)::int FROM visitor),(SELECT COUNT(*)::int FROM session) FROM inserted
        ON CONFLICT (date) DO UPDATE SET views="VisitorAnalyticsDay".views+1,
          visitors="VisitorAnalyticsDay".visitors+EXCLUDED.visitors,sessions="VisitorAnalyticsDay".sessions+EXCLUDED.sessions
        RETURNING date
      ) SELECT EXISTS(SELECT 1 FROM inserted) AS accepted`);
    return result[0];
  }
  private filter(query: VisitorReportQueryDto, start: Date, end: Date) {
    return Prisma.sql`"occurredAt" >= (${start}::timestamptz AT TIME ZONE 'UTC') AND "occurredAt" < (${end}::timestamptz AT TIME ZONE 'UTC')
      ${query.country ? Prisma.sql`AND country = ${query.country}` : Prisma.empty}
      ${query.device ? Prisma.sql`AND device = ${query.device}` : Prisma.empty}
      ${query.path ? Prisma.sql`AND path = ${query.path}` : Prisma.empty}`;
  }
  private grouped(column: 'country'|'path'|'source'|'device'|'browser'|'os', filter: Prisma.Sql, limit = 10) {
    const field = Prisma.raw(`"${column}"`);
    return this.prisma.$queryRaw<Group[]>(Prisma.sql`SELECT ${field} AS key, ${counts}
      ${column === 'path' ? Prisma.sql`, (ARRAY_AGG(title ORDER BY "occurredAt" DESC))[1] AS title` : Prisma.empty}
      FROM "VisitorEvent" WHERE ${filter} GROUP BY ${field} ORDER BY views DESC, key ASC LIMIT ${limit}`);
  }
  async report(query: VisitorReportQueryDto) {
    const range = reportRange(query);
    const filter = this.filter(query, range.start, range.end);
    const unfiltered = this.filter({} as VisitorReportQueryDto, range.start, range.end);
    const previousFilter = this.filter(query, range.previousStart, range.start);
    const hourly = query.from === query.to && !!query.from;
    const bucket = hourly ? Prisma.sql`TO_CHAR("occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Vientiane','YYYY-MM-DD HH24:00')` : Prisma.sql`TO_CHAR("occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Vientiane','YYYY-MM-DD')`;
    const [current, previous, trend, countries, pages, sources, devices, browsers, systems, history, totals, countryOptions, pathOptions, landingPages] = await Promise.all([
      this.prisma.$queryRaw<Counts[]>(Prisma.sql`SELECT ${counts} FROM "VisitorEvent" WHERE ${filter}`),
      this.prisma.$queryRaw<Counts[]>(Prisma.sql`SELECT ${counts} FROM "VisitorEvent" WHERE ${previousFilter}`),
      this.prisma.$queryRaw<(Counts & { bucket: string })[]>(Prisma.sql`SELECT ${bucket} AS bucket, ${counts} FROM "VisitorEvent" WHERE ${filter} GROUP BY bucket ORDER BY bucket`),
      this.grouped('country',filter,250), this.grouped('path',filter), this.grouped('source',filter), this.grouped('device',filter), this.grouped('browser',filter), this.grouped('os',filter),
      this.prisma.visitorAnalyticsDay.aggregate({ _min: { date: true }, _sum: { views: true } }),
      this.prisma.visitorAnalyticsDay.findMany({ where: { date: { gte: new Date(`${range.from}T00:00:00Z`), lte: new Date(`${range.to}T00:00:00Z`) } }, orderBy: { date: 'asc' } }),
      this.prisma.$queryRaw<{ key: string }[]>(Prisma.sql`SELECT DISTINCT country AS key FROM "VisitorEvent" WHERE ${unfiltered} ORDER BY key`),
      this.prisma.$queryRaw<{ key: string }[]>(Prisma.sql`SELECT DISTINCT path AS key FROM "VisitorEvent" WHERE ${unfiltered} ORDER BY key LIMIT 500`),
      this.prisma.$queryRaw<Group[]>(Prisma.sql`WITH selected AS (SELECT DISTINCT "sessionId" FROM "VisitorEvent" WHERE ${filter}),
        landing AS (SELECT DISTINCT ON ("sessionId") * FROM "VisitorEvent" WHERE "sessionId" IN (SELECT "sessionId" FROM selected) ORDER BY "sessionId","occurredAt",id)
        SELECT path AS key,(ARRAY_AGG(title ORDER BY "occurredAt" DESC))[1] AS title,${counts} FROM landing GROUP BY path ORDER BY views DESC,key ASC LIMIT 10`),
    ]);
    const filled = [];
    const step = hourly ? 3600000 : DAY;
    for (let timestamp=range.start.getTime(); timestamp<range.end.getTime(); timestamp+=step) {
      const date = new Date(timestamp);
      const key = hourly ? `${vientianeDay(date)} ${String((date.getUTCHours()+7)%24).padStart(2,'0')}:00` : vientianeDay(date);
      filled.push(trend.find(item=>item.bucket===key) || {bucket:key,views:0,visitors:0,sessions:0});
    }
    return {
      from: range.from, to: range.to, oldest: range.oldest, hourly, timezone: 'Asia/Vientiane', generatedAt: new Date(),
      startedAt: history._min.date, allTimeViews: history._sum.views || 0,
      current: current[0], previous: previous[0], previousAvailable: range.previousStart >= new Date(`${range.oldest}T00:00:00+07:00`) && !!history._min.date && range.previousStart >= new Date(history._min.date.getTime()-7*3600000),
      trend: filled, countries, pages, landingPages, sources, devices, browsers, systems,
      dailyHistory: totals, countryOptions, pathOptions, geoMode: this.geo.mode(), geoSource: this.geo.source(),
    };
  }
  async events(query: VisitorReportQueryDto, exporting = false) {
    const {start,end} = reportRange(query);
    const filter = this.filter(query,start,end);
    const load = async (db: Prisma.TransactionClient) => {
      const [totals] = await db.$queryRaw<{views:number;visitors?:number;sessions?:number}[]>(Prisma.sql`SELECT ${exporting ? counts : Prisma.sql`COUNT(*)::int AS views`} FROM "VisitorEvent" WHERE ${filter}`);
      const total = totals.views;
      const totalPages = Math.max(1,Math.ceil(total/query.limit));
      const page = Math.min(query.page,totalPages);
      if (exporting && total > 50000) throw new BadRequestException('Export is limited to 50,000 rows; choose a shorter date range');
      const data = await db.$queryRaw<EventRow[]>(Prisma.sql`SELECT id,LEFT("visitorHash",12) AS visitor,path,title,country,device,browser,os,source,"occurredAt" FROM "VisitorEvent" WHERE ${filter} ORDER BY "occurredAt" DESC,id DESC LIMIT ${exporting ? 50000 : query.limit} OFFSET ${exporting ? 0 : (page-1)*query.limit}`);
      return { data,total,page,totalPages,limit:query.limit,summary:exporting ? {views:total,visitors:totals.visitors!,sessions:totals.sessions!} : undefined };
    };
    // Both worksheets use one database snapshot while new visits are arriving.
    return exporting ? this.prisma.$transaction(load,{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead}) : load(this.prisma);
  }
}
