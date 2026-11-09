import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assetRelativePath } from '../src/media/storage';

const storage = resolve(process.env.MEDIA_DIRECTORY || './uploads');
const assets = join(storage, 'assets');

async function main() {
  let moved = 0;
  async function move(source: string, destination: string) {
    if (source === destination) return;
    await mkdir(dirname(destination), { recursive: true });
    try {
      const existing = await readFile(destination);
      const original = await readFile(source);
      const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
      if (hash(existing) !== hash(original)) throw new Error(`Conflicting file: ${destination}`);
      await unlink(source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await rename(source, destination);
    }
    moved++;
  }
  async function organizeAssets(directory: string, relative = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.name === '.DS_Store') { await unlink(path); continue; }
      if (entry.isDirectory()) {
        await organizeAssets(path, next);
        try { await rmdir(path); } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOTEMPTY') throw error;
        }
      } else if (entry.isFile()) await move(path, join(assets, assetRelativePath(next)));
    }
  }
  for (const path of ['assets/images', 'assets/icons', 'assets/fonts', 'assets/audio', 'assets/documents', 'media', 'migrations/reports', 'migrations/backups']) {
    await mkdir(join(storage, path), { recursive: true });
  }
  await organizeAssets(assets);
  for (const entry of await readdir(storage, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(storage, entry.name);
    if (entry.name === '.DS_Store') await unlink(path);
    else if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.name)) await move(path, join(storage, 'media', entry.name));
    else if (entry.name === 'asset-migration-report.json') await move(path, join(storage, 'migrations/reports/asset-migration.json'));
    else if (/^asset-url-backup-\d+\.json$/.test(entry.name)) await move(path, join(storage, 'migrations/backups', entry.name.replace('asset-url-backup-', 'asset-urls-')));
  }
  await writeFile(join(storage, 'README.md'), `# DPO file storage\n\n- assets/images: public photos, logos, and QR images\n- assets/icons: favicons, file icons, and web manifest\n- assets/fonts: website fonts\n- assets/audio: public audio\n- assets/documents: public PDFs and spreadsheets\n- media: files uploaded through the admin API (UUID names; metadata in database)\n- migrations/reports: migration reports\n- migrations/backups: previous URL values for rollback\n\nOnly assets/ is served at /api/assets/. Original /api/assets/dpo/... and favicon URLs remain supported.\nAdmin uploads are served at /api/media/{id}/content. Keep this entire directory on persistent storage.\nSee ASSETS.md in the API project for deployment and maintenance.\n`);
  console.log(JSON.stringify({ storage, moved }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
