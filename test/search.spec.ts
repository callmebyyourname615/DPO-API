import { PublicController } from '../src/content/public.controller';

describe('public search', () => {
  it('searches published news and pages by content and excludes scheduled news', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { news: { findMany }, document: { findMany: jest.fn().mockResolvedValue([]) }, page: { findMany: jest.fn().mockResolvedValue([]) } };
    const controller = new PublicController({} as any, prisma as any, {} as any);
    await controller.search({ q: '  ລາວ  ', page: 1, limit: 10 });
    const news = findMany.mock.calls[0][0].where;
    expect(news.status).toBe('published');
    expect(news.OR).toContainEqual({ content: { contains: 'ລາວ', mode: 'insensitive' } });
    expect(news.AND[0].OR[1].publishedAt.lte).toBeInstanceOf(Date);
    expect(prisma.page.findMany.mock.calls[0][0].where.OR).toContainEqual({ content: { contains: 'ລາວ', mode: 'insensitive' } });
  });
});
