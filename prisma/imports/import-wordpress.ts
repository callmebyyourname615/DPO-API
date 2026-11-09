import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import { localAsset } from '../asset-urls';

const prisma = new PrismaClient();
const snapshot = JSON.parse(readFileSync(join(__dirname, 'wordpress-2026-11-07.json'), 'utf8')) as {
  posts: Array<Prisma.NewsCreateManyInput & { sourceId: number; sourceUrl: string; gallery: string[]; content: string; slug: string }>;
  pages: Array<Prisma.PageCreateManyInput & { sourceId: number; sourceUrl: string }>;
};

async function main() {
  const counts = await prisma.$transaction(async (tx) => {
    const posts = snapshot.posts.map(({ sourceId, sourceUrl: _sourceUrl, publishedAt, ...post }) => ({
      ...post, coverImageUrl: localAsset(post.coverImageUrl), gallery: post.gallery.map(url => localAsset(url)!), id: `wordpress-news-${sourceId}`, publishedAt: publishedAt ? new Date(publishedAt as string) : null,
    }));
    const pages = snapshot.pages.map(({ sourceId, sourceUrl: _sourceUrl, ...page }) => ({ ...page, imageUrl: localAsset(page.imageUrl), id: `wordpress-page-${sourceId}` }));
    const addedNews = await tx.news.createMany({ data: posts, skipDuplicates: true });
    const addedPages = await tx.page.createMany({ data: pages, skipDuplicates: true });
    let completedDrafts = 0;
    for (const post of posts) {
      if (!post.content) continue;
      const result = await tx.news.updateMany({ where: { slug: post.slug, id: { startsWith: 'legacy-news-' }, content: '', status: 'draft' }, data: { content: post.content } });
      completedDrafts += result.count;
    }
    return { newsAdded: addedNews.count, pagesAdded: addedPages.count, legacyDraftsWithContentAdded: completedDrafts };
  }, { timeout: 30000 });
  console.log(JSON.stringify(counts));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
