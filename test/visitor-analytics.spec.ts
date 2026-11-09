import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { VisitorAnalyticsService, referrerHost, reportRange, visitorAgent } from '../src/content/visitor-analytics.service';
import { VisitorGeoService } from '../src/content/visitor-geo.service';
import { VisitorEventDto, VisitorReportQueryDto } from '../src/common/dto/analytics.dto';
import { validateInput } from '../src/content/content.service';
import { vientianeDay } from '../src/content/visitor.service';

const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
describe('visitor analytics validation',()=>{
  it('handles Vientiane boundaries, impossible dates, inverted and old ranges',()=>{
    const now=new Date('2026-11-09T17:30:00Z');
    const result=reportRange({from:'2026-11-10',to:'2026-11-10'} as VisitorReportQueryDto,now);
    expect(result.start.toISOString()).toBe('2026-11-09T17:00:00.000Z');
    expect(result.end.toISOString()).toBe('2026-11-10T17:00:00.000Z');
    for(const dates of [{to:'bad-date'},{from:'2026-02-30',to:'2026-11-10'},{from:'2026-11-10',to:'2026-11-09'},{from:'2026-01-01',to:'2026-11-09'},{to:'2026-11-11'}]) expect(()=>reportRange(dates as VisitorReportQueryDto,now)).toThrow();
  });
  it('rejects query strings, spoofed country fields, malformed IDs, and oversized payloads',()=>{
    const body={id:randomUUID(),visitorId:randomUUID(),sessionId:randomUUID(),path:'/news/'};
    expect(validateInput(VisitorEventDto,body).path).toBe('/news/');
    for(const patch of [{path:'/news/?email=secret'},{path:'//evil.test/'},{country:'LA'},{visitorId:'wrong'},{title:'x'.repeat(201)},{title:'bad\u0000title'},{path:'/bad\u0000/'}]) expect(()=>validateInput(VisitorEventDto,{...body,...patch})).toThrow();
  });
  it('extracts browser information and stores only a referrer hostname',()=>{
    expect(visitorAgent(ua)).toEqual({device:'desktop',browser:'Chrome',os:'Windows'});
    expect(referrerHost('https://search.example/a?q=private')).toBe('search.example');
    expect(referrerHost('javascript:alert(1)')).toBe('Direct');
  });
  it('ignores a country header from an untrusted peer',()=>{
    const previous=process.env.ANALYTICS_COUNTRY_HEADER;process.env.ANALYTICS_COUNTRY_HEADER='cf-ipcountry';
    try{
      const geo=new VisitorGeoService();
      const req={socket:{remoteAddress:'127.0.0.1'},ip:'127.0.0.1',get:()=> 'LA',app:{get:()=>()=>false}} as any;
      expect(geo.country(req)).toBe('ZZ');
      req.app.get=()=>()=>true;expect(geo.country(req)).toBe('LA');
      req.get=()=> 'XX';expect(geo.country(req)).toBe('ZZ');
    }finally{if(previous===undefined)delete process.env.ANALYTICS_COUNTRY_HEADER;else process.env.ANALYTICS_COUNTRY_HEADER=previous;}
  });
});

describe('visitor analytics PostgreSQL integration in an isolated schema',()=>{
  const schema=`visitor_test_${randomUUID().replace(/-/g,'')}`;
  let root:PrismaClient,prisma:PrismaClient,service:VisitorAnalyticsService;
  let country='LA';
  const request={get:(header:string)=>header==='user-agent'?ua:undefined} as any;
  const body=(overrides:Partial<VisitorEventDto>={}):VisitorEventDto=>({id:randomUUID(),visitorId:randomUUID(),sessionId:randomUUID(),path:'/news/',title:'News',referrer:'https://search.example/?private=1',...overrides});
  beforeAll(async()=>{
    root=new PrismaClient();
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const url=new URL(process.env.DATABASE_URL!);url.searchParams.set('schema',schema);
    prisma=new PrismaClient({datasourceUrl:url.toString()});
    const sql=await readFile('prisma/migrations/20261109010000_visitor_analytics/migration.sql','utf8');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await prisma.$executeRawUnsafe(statement);
    service=new VisitorAnalyticsService(prisma as any,{country:()=>country,mode:()=> 'geoip',source:()=>null} as any);
  });
  beforeEach(async()=>{
    country='LA';
    await prisma.$executeRawUnsafe('TRUNCATE "VisitorEvent","VisitorAnalyticsDay","VisitorIdentityDay","VisitorSessionDay"');
  });
  afterAll(async()=>{await prisma?.$disconnect();if(root){await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await root.$disconnect();}});
  it('counts concurrent duplicate deliveries exactly once',async()=>{
    const event=body();
    await Promise.all(Array.from({length:12},()=>service.record(event,request)));
    expect(await prisma.visitorEvent.count()).toBe(1);
    expect(await prisma.visitorAnalyticsDay.findFirst()).toEqual(expect.objectContaining({views:1,visitors:1,sessions:1}));
    expect((await prisma.visitorEvent.findFirst())?.visitorHash).not.toContain(event.visitorId);
    expect(Math.abs((await prisma.visitorEvent.findFirst())!.occurredAt.getTime()-Date.now())).toBeLessThan(3000);
  });
  it('distinguishes page views, sessions and visitors and supports country/device/page filters',async()=>{
    const first=body();
    await service.record(first,request);
    await service.record({...first,id:randomUUID(),path:'/contact/'},request);
    await service.record({...first,id:randomUUID(),sessionId:randomUUID()},request);
    country='TH';await service.record(body(),request);
    const today=vientianeDay();
    const report=await service.report({from:today,to:today} as VisitorReportQueryDto);
    expect(report.current).toEqual({views:4,visitors:2,sessions:3});
    expect(report.trend).toHaveLength(24);
    expect(report.trend.reduce((sum,row)=>sum+row.views,0)).toBe(4);
    expect(report.countries.find(row=>row.key==='LA')).toEqual({key:'LA',views:3,visitors:1,sessions:2});
    const filtered=await service.report({from:today,to:today,country:'LA',device:'desktop',path:'/contact/'} as VisitorReportQueryDto);
    expect(filtered.current).toEqual({views:1,visitors:1,sessions:1});
    const events=await service.events({from:today,to:today,country:'LA',page:1,limit:20});
    expect(events.total).toBe(3);expect(events.data[0].visitor).toHaveLength(12);
    expect(report.allTimeViews).toBe(4);
    expect(await prisma.visitorAnalyticsDay.findFirst()).toEqual(expect.objectContaining({views:4,visitors:2,sessions:3}));
  });
  it('returns zero reports, ignores known bots and handles pagination',async()=>{
    expect(await service.record(body(),{get:()=> 'Googlebot'} as any)).toEqual({accepted:false});
    const today=vientianeDay();
    expect((await service.report({from:today,to:today} as VisitorReportQueryDto)).current).toEqual({views:0,visitors:0,sessions:0});
    for(let i=0;i<23;i++)await service.record(body(),request);
    const results=await service.events({from:today,to:today,page:2,limit:20});
    expect(results.data).toHaveLength(3);expect(results.totalPages).toBe(2);
  });
  it('prunes old detail but keeps the historical daily aggregate',async()=>{
    const event=body();await service.record(event,request);
    const old=new Date(Date.now()-100*86400000);
    await prisma.visitorEvent.update({where:{id:event.id},data:{occurredAt:old}});
    await prisma.visitorAnalyticsDay.updateMany({data:{date:old}});
    await prisma.visitorIdentityDay.updateMany({data:{date:old}});
    await prisma.visitorSessionDay.updateMany({data:{date:old}});
    await service.prune();
    expect(await prisma.visitorEvent.count()).toBe(0);
    expect(await prisma.visitorIdentityDay.count()).toBe(0);
    expect(await prisma.visitorSessionDay.count()).toBe(0);
    expect((await prisma.visitorAnalyticsDay.findFirst())?.views).toBe(1);
  });
  it('uses UTC storage and Vientiane report boundaries regardless of the database timezone',async()=>{
    const today=vientianeDay();
    const range=reportRange({from:today,to:today} as VisitorReportQueryDto);
    for(const time of [range.start.getTime()-1,range.start.getTime(),range.start.getTime()+1000,range.end.getTime()]){
      const event=body();await service.record(event,request);
      await prisma.visitorEvent.update({where:{id:event.id},data:{occurredAt:new Date(time)}});
    }
    const report=await service.report({from:today,to:today} as VisitorReportQueryDto);
    expect(report.current.views).toBe(2);
    expect(report.trend[0].views).toBe(2);
    expect(report.trend.slice(1).every(row=>row.views===0)).toBe(true);
  });
});
