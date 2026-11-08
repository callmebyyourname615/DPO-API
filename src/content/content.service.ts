import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BannerDto, DocumentDto, FaqDto, InquiryUpdateDto, ListQueryDto, NewsDto, PageDto, PartnerDto } from '../common/dto';

const resources = {
  news: { model: 'news', dto: NewsDto, required: ['title','slug','category','content'], search: ['title','excerpt'], sortable: false },
  documents: { model: 'document', dto: DocumentDto, required: ['title','category'], search: ['title','fileName'], sortable: false },
  inquiries: { model: 'inquiry', dto: InquiryUpdateDto, required: [], search: ['name','email','subject'], sortable: false },
  faqs: { model: 'faq', dto: FaqDto, required: ['question','answer'], search: ['question','answer'], sortable: true },
  partners: { model: 'partner', dto: PartnerDto, required: ['name','url'], search: ['name'], sortable: true },
  banners: { model: 'banner', dto: BannerDto, required: ['title'], search: ['title'], sortable: true },
  pages: { model: 'page', dto: PageDto, required: ['title','slug','content'], search: ['title','slug'], sortable: false },
  media: { model: 'media', dto: null, required: [], search: ['fileName'], sortable: false },
} as const;
export type Resource = keyof typeof resources;
export function resourceConfig(resource: string) {
  if (!Object.prototype.hasOwnProperty.call(resources, resource)) throw new NotFoundException('Resource not found');
  return resources[resource as Resource];
}
export function validateInput<T extends object>(dto: new () => T, raw: unknown): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Expected a JSON object');
  const input = plainToInstance(dto, raw);
  const errors = validateSync(input, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) throw new BadRequestException(errors.flatMap((e) => Object.values(e.constraints || {})));
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}
function normalizeDates(data: Record<string, any>) {
  for (const key of ['publishedAt', 'documentDate']) if (key in data) data[key] = data[key] ? new Date(data[key]) : null;
  for (const key of ['coverImageUrl','imageUrl','logoUrl','fileUrl','footerAudioUrl','footerAudioUrl2','fileType']) if (data[key] === '') data[key] = null;
  return data;
}
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}
  private table(resource: string): any {
    const config = resourceConfig(resource);
    return (this.prisma as any)[config.model];
  }
  private mapError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A record with this value already exists');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Record not found');
    throw error;
  }
  async list(resource: string, query: ListQueryDto, publicOnly = false) {
    const config = resourceConfig(resource);
    const where: Record<string, any> = {};
    if (query.q?.trim()) where.OR = config.search.map((field) => ({ [field]: { contains: query.q!.trim(), mode: 'insensitive' } }));
    if (query.category && (resource === 'news' || resource === 'documents')) where.category = query.category;
    if (query.status && !publicOnly && resource !== 'media') where.status = query.status;
    if (publicOnly) {
      where.status = 'published';
      if (resource === 'news') where.AND = [{ OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] }];
    }
    const table = this.table(resource);
    try {
      const total = await table.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / query.limit));
      const page = Math.min(query.page, totalPages);
      const data = await table.findMany({ where, skip: (page - 1) * query.limit, take: query.limit, orderBy: config.sortable ? [{ order: 'asc' }, { createdAt: 'desc' }] : resource === 'news' ? [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }] : { createdAt: 'desc' } });
      return { data, page, limit: query.limit, total, totalPages };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientValidationError) throw new BadRequestException('Invalid filter');
      throw error;
    }
  }
  async get(resource: string, id: string) {
    const row = await this.table(resource).findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Record not found');
    return row;
  }
  async bySlug(resource: 'news' | 'pages', slug: string) {
    const row = await this.table(resource).findFirst({ where: { slug, status: 'published', ...(resource === 'news' ? { OR: [{publishedAt: null}, {publishedAt: {lte: new Date()}}] } : {}) } });
    if (!row) throw new NotFoundException('Record not found');
    return row;
  }
  async slugAvailable(resource: 'news' | 'pages', slug: string, excludeId?: string) {
    const row = await this.table(resource).findUnique({ where: { slug }, select: { id: true } });
    return { available: !row || row.id === excludeId };
  }
  async create(resource: string, raw: unknown) {
    const config = resourceConfig(resource);
    if (!config.dto || resource === 'inquiries') throw new NotFoundException();
    const data = validateInput(config.dto as new () => object, raw) as Record<string, any>;
    for (const key of config.required) if (typeof data[key] !== 'string' || !data[key].trim()) throw new BadRequestException(`${key} is required`);
    try { return await this.table(resource).create({ data: normalizeDates(data) }); } catch (error) { return this.mapError(error); }
  }
  async update(resource: string, id: string, raw: unknown) {
    const config = resourceConfig(resource);
    if (!config.dto) throw new NotFoundException();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Expected a JSON object');
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...editable } = raw as Record<string, unknown>;
    const data = validateInput(config.dto as new () => object, editable) as Record<string, any>;
    if (!Object.keys(data).length) throw new BadRequestException('No fields to update');
    try { return await this.table(resource).update({ where: { id }, data: normalizeDates(data) }); } catch (error) { return this.mapError(error); }
  }
  async remove(resource: string, id: string) {
    if (resource === 'inquiries' || resource === 'media') throw new NotFoundException();
    try { await this.table(resource).delete({ where: { id } }); } catch (error) { this.mapError(error); }
  }
  async settings() {
    const { id, ...settings } = await this.prisma.siteSettings.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    return settings;
  }
  async intro() {
    const { id, ...intro } = await this.prisma.homeIntro.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    return intro;
  }
  async updateSingleton(kind: 'intro' | 'settings', data: Record<string, unknown>) {
    const table = kind === 'intro' ? this.prisma.homeIntro : this.prisma.siteSettings;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...editable } = data;
    const { id, ...row } = await (table as any).upsert({ where: { id: 'main' }, update: editable, create: { id: 'main', ...editable } });
    return row;
  }
  async stats() {
    const [news, documents, inquiries, faqs] = await Promise.all([
      this.prisma.news.findMany({ select: { status: true, publishedAt: true, createdAt: true } }),
      this.prisma.document.findMany({ select: { category: true } }),
      this.prisma.inquiry.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.faq.count({ where: { status: 'published' } }),
    ]);
    const months = new Map<string, { month: string; published: number; draft: number }>();
    for (const row of news) { const month = (row.publishedAt ?? row.createdAt).toISOString().slice(0,7); const item = months.get(month) || {month, published: 0, draft: 0}; item[row.status]++; months.set(month, item); }
    const categories = new Map<string, number>();
    for (const row of documents) categories.set(row.category, (categories.get(row.category) || 0) + 1);
    return { newsTotal: news.length, newsPublished: news.filter((row) => row.status === 'published').length, documentsTotal: documents.length, inquiriesNew: inquiries.find((row) => row.status === 'new')?._count._all || 0, inquiriesTotal: inquiries.reduce((sum, row) => sum + row._count._all, 0), faqsPublished: faqs, newsByMonth: [...months.values()].sort((a,b) => a.month.localeCompare(b.month)), documentsByCategory: [...categories].map(([category,count]) => ({category,count})) };
  }
}
