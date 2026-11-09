import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { assetRelativePath } from '../src/media/storage';

const prisma = new PrismaClient();
const root = resolve(__dirname, '..');
const storage = resolve(process.env.MEDIA_DIRECTORY || './uploads');
const publicRoot = join(storage, 'assets');
const reports = join(storage, 'migrations/reports');
const backups = join(storage, 'migrations/backups');
const mappingFile = join(root, 'prisma/seed-data/asset-urls.json');
const fields = {
  news: ['coverImageUrl', 'gallery'], document: ['fileUrl'], page: ['imageUrl'],
  partner: ['logoUrl'], banner: ['imageUrl'], homeIntro: ['imageUrl'],
  siteSettings: ['footerAudioUrl', 'footerAudioUrl2'],
} as const;
type Model = keyof typeof fields;

async function main() {
  const mapping: Record<string, string> = JSON.parse(await readFile(mappingFile, 'utf8'));
  const aliases = new Map<string, string>();
  const canonical = (url: string) => { try { return decodeURI(new URL(url).href); } catch { return url; } };
  const apiPath = (path: string) => `/api${path}`;
  const diskPath = (url: string) => {
    if (!/^\/api\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(url)) throw new Error(`Invalid asset path: ${url}`);
    return join(publicRoot, assetRelativePath(url.slice('/api/assets/'.length)));
  };
  await mkdir(publicRoot, { recursive: true });
  await mkdir(reports, { recursive: true });
  await mkdir(backups, { recursive: true });
  // Copy first; the frontend copy is removed only after HTTP and build verification.
  const frontend = resolve(process.argv[2] || join(root, '../DPO_Frontend/public'));
  async function copyDirectory(source: string, relative = '') {
    for (const entry of await readdir(source, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const next = join(relative, entry.name);
      if (entry.isDirectory()) await copyDirectory(join(source, entry.name), next);
      else if (entry.isFile()) {
        const destination = join(publicRoot, assetRelativePath(next));
        await mkdir(dirname(destination), { recursive: true });
        try { await copyFile(join(source, entry.name), destination, 1); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
        mapping[`/assets/${next}`] = `/api/assets/${next}`;
      }
    }
  }
  try { await copyDirectory(join(frontend, 'assets')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  // Favicons and the manifest are also served by the API.
  await mkdir(join(publicRoot, 'icons'), { recursive: true });
  for (const name of ['favicon.ico', 'favicon.png', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'site.webmanifest']) {
    try { await copyFile(join(frontend, name), diskPath(`/api/assets/${name}`), 1); }
    catch (error) { if (!['ENOENT', 'EEXIST'].includes((error as NodeJS.ErrnoException).code || '')) throw error; }
  }
  const manifestPath = diskPath('/api/assets/site.webmanifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const icon of manifest.icons) icon.src = icon.src.replace(/^\//, '');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const snapshots = join(root, 'prisma/seed-data');
  const assets = JSON.parse(await readFile(join(snapshots, 'assets.json'), 'utf8'));
  for (const asset of Object.values(assets) as any[]) {
    if (asset.source && asset.src?.startsWith('/assets/')) aliases.set(canonical(asset.source), apiPath(asset.src));
  }
  function documentAliases(value: any) {
    if (Array.isArray(value)) return value.forEach(documentAliases);
    if (!value || typeof value !== 'object') return;
    if (value.local?.startsWith('/assets/')) {
      for (const key of ['download', 'preview']) if (value[key]) aliases.set(canonical(value[key]), apiPath(value.local));
    }
    Object.values(value).forEach(documentAliases);
  }
  for (const name of ['decrees', 'legal-documents', 'fsnp', 'information']) documentAliases(JSON.parse(await readFile(join(snapshots, `${name}.json`), 'utf8')));
  // General documents have legacy download links assembled by seed.ts.
  for (const item of JSON.parse(await readFile(join(snapshots, 'information.json'), 'utf8'))) {
    const url = `https://www.dpo.gov.la/wp-admin/admin-ajax.php?juwpfisadmin=false&action=wpfd&task=file.download&wpfd_category_id=86&wpfd_file_id=${item.id}&token=&preview=1`;
    aliases.set(canonical(url), `/api/assets/dpo/documents/${item.id}.pdf`);
  }
  const rows: { model: Model; row: any }[] = [];
  for (const model of Object.keys(fields) as Model[]) for (const row of await (prisma[model] as any).findMany()) rows.push({ model, row });
  const urls = new Set<string>([...aliases.keys()]);
  for (const { model, row } of rows) for (const key of fields[model]) {
    for (const url of Array.isArray(row[key]) ? row[key] : [row[key]]) if (url) urls.add(url);
  }
  const failed: { url: string; error: string }[] = [];
  const queue = [...urls]; let completed = 0;
  async function migrate(url: string) {
    if (url.startsWith('/api/assets/')) {
      if ((await stat(diskPath(url))).size <= 0) throw new Error(`Empty asset: ${url}`);
      return;
    }
    if (url.startsWith('/api/')) return;
    const source = canonical(url);
    let destination = mapping[url] || aliases.get(source);
    if (destination) {
      try { if ((await stat(diskPath(destination))).size > 0) { mapping[url] = destination; return; } } catch { /* Fetch missing source below. */ }
    }
    const parsed = new URL(url);
    if (!['www.dpo.gov.la', 'dpo.gov.la'].includes(parsed.hostname) || !['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Unexpected asset origin: ${parsed.origin}`);
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(parsed, { signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const types: [string, boolean][] = [
          ['jpg', bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))],
          ['png', bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))],
          ['gif', bytes.subarray(0, 3).toString() === 'GIF'],
          ['pdf', bytes.subarray(0, 5).toString() === '%PDF-'],
          ['xlsx', bytes.subarray(0, 4).equals(Buffer.from([80,75,3,4]))],
          ['webp', bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'],
          ['mp3', bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224],
        ];
        const extension = types.find(([, matches]) => matches)?.[0];
        if (!extension) throw new Error(`Unsupported file data (${response.headers.get('content-type')})`);
        if (!destination) destination = `/api/assets/dpo/${createHash('sha256').update(source).digest('hex').slice(0, 16)}.${extension}`;
        if (!['jpg','jpeg'].includes(extension) && extname(destination) !== `.${extension}`) throw new Error('File type does not match destination');
        const path = diskPath(destination);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(`${path}.tmp`, bytes);
        await rename(`${path}.tmp`, path);
        mapping[url] = destination;
        return;
      } catch (error) { lastError = error; }
    }
    throw lastError;
  }
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const url = queue.shift()!;
      try { await migrate(url); } catch (error) { failed.push({ url, error: String(error) }); }
      if (++completed % 25 === 0) console.log(`Assets checked: ${completed}/${urls.size}`);
    }
  }));
  await writeFile(`${mappingFile}.tmp`, `${JSON.stringify(mapping, null, 2)}\n`);
  await rename(`${mappingFile}.tmp`, mappingFile);
  const report = { checked: urls.size, mapped: Object.keys(mapping).length, failed };
  await writeFile(join(reports, 'asset-migration.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (failed.length) throw new Error(`${failed.length} assets could not be migrated; database unchanged. See ${reports}/asset-migration.json`);
  const changes = rows.map(({ model, row }) => {
    const before: any = {}; const after: any = {};
    for (const key of fields[model]) {
      const old = row[key]; const next = Array.isArray(old) ? old.map(url => mapping[url] || url) : mapping[old] || old;
      if (JSON.stringify(old) !== JSON.stringify(next)) { before[key] = old; after[key] = next; }
    }
    return { model, id: row.id, updatedAt: row.updatedAt, before, after };
  }).filter(change => Object.keys(change.after).length);
  if (changes.length) {
    await writeFile(join(backups, `asset-urls-${Date.now()}.json`), `${JSON.stringify(changes, null, 2)}\n`, { flag: 'wx' });
    await prisma.$transaction(async tx => {
      for (const change of changes) {
        const result = await (tx[change.model] as any).updateMany({ where: { id: change.id, updatedAt: change.updatedAt }, data: change.after });
        if (result.count !== 1) throw new Error(`Content changed during migration: ${change.model}/${change.id}; retry migration`);
      }
    }, { timeout: 60000 });
  }
  console.log(JSON.stringify({ ...report, updatedRecords: changes.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
