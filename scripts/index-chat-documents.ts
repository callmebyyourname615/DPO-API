import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { execFile } from 'node:child_process';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { sourceHash } from '../src/chat/english';
import { assetRelativePath } from '../src/media/storage';
import type { IndexedContent } from '../src/chat/indexed-content';

type Extracted = IndexedContent;
const execute = promisify(execFile);
const prisma = new PrismaClient();
async function save(path: string, value: unknown) {
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}
async function main() {
  await ConfigModule.forRoot();
  const directory = resolve(process.argv[2] || resolve(process.env.MEDIA_DIRECTORY || './uploads', 'assets/documents'));
  const assets = dirname(directory);
  const useOcr = process.argv.includes('--ocr');
  const cache = resolve(process.env.MEDIA_DIRECTORY || './uploads', 'chat-ocr-cache');
  const [documents, pages] = await Promise.all([
    prisma.document.findMany({ where: { status: 'published', fileStatus: 'available' }, orderBy: { id: 'asc' } }),
    prisma.page.findMany({ where: { status: 'published', imageUrl: { not: null } }, orderBy: { id: 'asc' } }),
  ]);
  let previousImages: Record<string, Extracted> = {};
  const previousDocuments: Record<string, Extracted> = JSON.parse(await readFile(resolve(__dirname, '../src/chat/document-text.json'), 'utf8'));
  try { previousImages = JSON.parse(await readFile(resolve(__dirname, '../src/chat/image-text.json'), 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const index: Record<string, Extracted> = {};
  const images: Record<string, Extracted> = {};
  const report: { id: string; type: string; units: number; readable: number; ocr: number; status: string }[] = [];
  const jobs = [
    ...documents.filter(document => ['pdf', 'xlsx'].includes(document.fileType || '')).map(document => ({ id: document.id, title: document.title, url: document.fileUrl || '', kind: document.fileType as 'pdf' | 'xlsx', hash: sourceHash(document.title, `${document.fileUrl}\n${document.updatedAt.toISOString()}`) })),
    ...(useOcr ? pages.map(page => ({ id: `page:${page.id}`, title: page.title, url: page.imageUrl!, kind: 'image' as const, hash: sourceHash(page.title, `${page.imageUrl}\n${page.updatedAt.toISOString()}\n${page.content}`) })) : []),
  ];
  function assetPath(job: typeof jobs[number]) {
    if (job.url.startsWith('/api/assets/')) {
      const path = resolve(assets, assetRelativePath(decodeURIComponent(job.url.slice('/api/assets/'.length).split(/[?#]/)[0])));
      const child = relative(assets, path);
      if (child.startsWith('..') || isAbsolute(child)) throw new Error('Asset path leaves public assets');
      return path;
    }
    const filename = job.id.replace(/^legacy-document-/, '');
    if (job.kind === 'image' || !/^[a-z0-9-]+$/i.test(filename)) throw new Error('No matching local public asset');
    return resolve(directory, `${filename}.${job.kind}`);
  }
  async function worker() {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      try {
        const path = assetPath(job);
        const args = [resolve(__dirname, 'extract-chat-content.py'), path, '--kind', job.kind, '--cache', cache];
        if (useOcr) args.push('--ocr');
        if (/[\u0e80-\u0eff]/u.test(job.title)) args.push('--lao');
        const { stdout } = await execute('python3', args, { encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 });
        let extracted: Extracted = { ...JSON.parse(stdout), sourceHash: job.hash };
        const reviewed = (job.kind === 'image' ? previousImages : previousDocuments)[job.id];
        if (extracted.fileHash && reviewed?.fileHash === extracted.fileHash && (reviewed.methods?.includes('reviewed') || reviewed.reviewedFields?.length)) extracted = { ...reviewed, sourceHash: job.hash };
        const readable = extracted.pages.filter(text => text.trim()).length;
        if (readable) (job.kind === 'image' ? images : index)[job.id] = extracted;
        const ocr = extracted.methods?.filter(method => method === 'ocr').length || 0;
        report.push({ id: job.id, type: job.kind, units: extracted.pages.length, readable, ocr, status: readable ? 'indexed' : 'source-link-only' });
        console.log(`${job.id}: ${readable}/${extracted.pages.length} units indexed (${ocr} OCR)`);
      } catch (error) {
        report.push({ id: job.id, type: job.kind, units: 0, readable: 0, ocr: 0, status: 'extraction-failed' });
        console.log(`${job.id}: extraction failed; source link remains available (${error instanceof Error && 'code' in error ? error.code : 'local asset unavailable'})`);
      }
    }
  }
  // Two bounded workers keep OCR from saturating the development machine.
  await Promise.all([worker(), worker()]);
  const ordered = (value: Record<string, Extracted>) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  await save(resolve(__dirname, '../src/chat/document-text.json'), ordered(index));
  if (useOcr) await save(resolve(__dirname, '../src/chat/image-text.json'), ordered(images));
  const coverage = { generatedAt: new Date().toISOString(), ocrEnabled: useOcr, documents: Object.keys(index).length, pageImages: Object.keys(images).length, records: report.sort((a, b) => a.id.localeCompare(b.id)) };
  await save(resolve(__dirname, '../CHATBOT_COVERAGE.json'), coverage);
  console.log(`Indexed ${coverage.documents}/${documents.length} public documents and ${coverage.pageImages} page images. No database records were changed.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
