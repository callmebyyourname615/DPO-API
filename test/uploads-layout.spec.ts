import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const execute = promisify(execFile);
const script = resolve(__dirname, '../scripts/organize-uploads.ts');
const id = '1ef677fa-7db1-46ac-9b8f-01c78bf84bf5';

describe('uploads organization', () => {
  let directory: string;
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'dpo-layout-')); });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
  const run = (storage: string) => execute(process.execPath, ['--import', 'tsx', script], {
    env: { ...process.env, MEDIA_DIRECTORY: storage },
  });
  it('moves each file without changing its bytes and can be rerun', async () => {
    const files: Record<string, string> = {
      'assets/dpo/photo.jpg': 'assets/images/photo.jpg',
      'assets/dpo/font.ttf': 'assets/fonts/font.ttf',
      'assets/dpo/spot.mp3': 'assets/audio/spot.mp3',
      'assets/dpo/documents/123.pdf': 'assets/documents/123.pdf',
      'assets/dpo/pdf.svg': 'assets/icons/pdf.svg',
      'assets/favicon.ico': 'assets/icons/favicon.ico',
      [id]: `media/${id}`,
      'asset-migration-report.json': 'migrations/reports/asset-migration.json',
      'asset-url-backup-123.json': 'migrations/backups/asset-urls-123.json',
    };
    for (const source of Object.keys(files)) {
      await mkdir(join(directory, source, '..'), { recursive: true });
      await writeFile(join(directory, source), `bytes:${source}`);
    }
    await writeFile(join(directory, '.DS_Store'), 'finder');
    const first = await run(directory);
    expect(JSON.parse(first.stdout).moved).toBe(Object.keys(files).length);
    for (const [source, target] of Object.entries(files)) {
      expect(await readFile(join(directory, target), 'utf8')).toBe(`bytes:${source}`);
    }
    expect((await readdir(directory)).sort()).toEqual(['README.md', 'assets', 'media', 'migrations']);
    expect(JSON.parse((await run(directory)).stdout).moved).toBe(0);
  });
  it('refuses to overwrite a different file at the destination', async () => {
    await mkdir(join(directory, 'assets/dpo'), { recursive: true });
    await mkdir(join(directory, 'assets/images'), { recursive: true });
    await writeFile(join(directory, 'assets/dpo/photo.jpg'), 'source');
    await writeFile(join(directory, 'assets/images/photo.jpg'), 'destination');
    await expect(run(directory)).rejects.toThrow();
    expect(await readFile(join(directory, 'assets/dpo/photo.jpg'), 'utf8')).toBe('source');
    expect(await readFile(join(directory, 'assets/images/photo.jpg'), 'utf8')).toBe('destination');
  });
});
