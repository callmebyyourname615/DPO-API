import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContentService } from './content.service';
import { VisitorService } from './visitor.service';
import { InquiryCreateDto, ListQueryDto } from '../common/dto';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import type { Response } from 'express';

@Controller()
export class PublicController {
  constructor(private readonly content: ContentService, private readonly prisma: PrismaService, private readonly media: MediaService, private readonly visitors: VisitorService) {}
  @Get('health') health() { return { status: 'ok' }; }
  @Get('visitors') visitorStats() { return this.visitors.stats(); }
  @Post('visitors') @Throttle({ default: { limit: 20, ttl: 60000 } }) recordVisit() { return this.visitors.record(); }
  @Get('media/:id/content') async file(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const { record, stream } = await this.media.content(id);
    response.set({ 'Content-Type': record.mimeType, 'Content-Length': String(record.size), 'Content-Disposition': record.mimeType.includes('spreadsheetml') ? 'attachment' : 'inline', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    return new StreamableFile(stream);
  }
  @Get('news') news(@Query() q: ListQueryDto) { return this.content.list('news', q, true); }
  @Get('news/:slug') async newsDetail(@Param('slug') slug: string) {
    const article = await this.content.bySlug('news', slug);
    const related = await this.prisma.news.findMany({ where: { id: { not: article.id }, category: article.category, status: 'published', OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] }, take: 3, orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], select: { id: true, title: true, slug: true, category: true, excerpt: true, coverImageUrl: true, publishedAt: true } });
    return { ...article, related };
  }
  @Get('documents') documents(@Query() q: ListQueryDto) { return this.content.list('documents', q, true); }
  @Get('faqs') faqs(@Query() q: ListQueryDto) { return this.content.list('faqs', q, true); }
  @Get('partners') partners(@Query() q: ListQueryDto) { return this.content.list('partners', q, true); }
  @Get('home') async home() {
    const [banners, intro] = await Promise.all([this.content.list('banners', { page: 1, limit: 100 }, true), this.content.intro()]);
    return { banners: banners.data, intro };
  }
  @Get('pages/:slug') page(@Param('slug') slug: string) { return this.content.bySlug('pages', slug); }
  @Get('site-settings') settings() { return this.content.settings(); }
  @Post('inquiries') @Throttle({ default: { limit: 5, ttl: 60000 } })
  async inquiry(@Body() dto: InquiryCreateDto) {
    const inquiry = await this.prisma.inquiry.create({ data: { name: dto.name.trim(), email: dto.email.trim().toLowerCase(), subject: dto.subject?.trim() || '', message: dto.message.trim(), source: dto.source === 'faq' ? 'faq' : 'contact' }, select: { id: true, createdAt: true } });
    return { id: inquiry.id, createdAt: inquiry.createdAt };
  }
  @Get('search') async search(@Query() query: ListQueryDto) {
    const q = query.q?.trim() || '';
    if (!q) return { news: [], documents: [], pages: [] };
    const [news, documents, pages] = await Promise.all([
      this.prisma.news.findMany({ where: { status: 'published', OR: [{title: {contains: q, mode: 'insensitive'}}, {excerpt: {contains: q, mode: 'insensitive'}}, {content: {contains: q, mode: 'insensitive'}}], AND: [{OR: [{publishedAt: null}, {publishedAt: {lte: new Date()}}]}] }, take: query.limit, select: {id:true,title:true,slug:true,excerpt:true,coverImageUrl:true,publishedAt:true} }),
      this.prisma.document.findMany({ where: { status: 'published', title: {contains: q, mode: 'insensitive'} }, take: query.limit, select: {id:true,title:true,category:true,fileUrl:true} }),
      this.prisma.page.findMany({ where: { status: 'published', OR: [{title: {contains: q, mode: 'insensitive'}}, {content: {contains: q, mode: 'insensitive'}}] }, take: query.limit, select: {id:true,title:true,slug:true} }),
    ]);
    return { news, documents, pages };
  }
}
