import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import request = require('supertest');
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveAssets } from '../src/media/assets';
import { PublicController } from '../src/content/public.controller';
import { ContentService } from '../src/content/content.service';
import { VisitorService } from '../src/content/visitor.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaService } from '../src/media/media.service';
import { Readable } from 'node:stream';

describe('public API assets', () => {
  let app: NestExpressApplication;
  let directory: string;
  const original = process.env.MEDIA_DIRECTORY;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'dpo-assets-'));
    process.env.MEDIA_DIRECTORY = directory;
    await mkdir(join(directory, 'assets/audio'), { recursive: true });
    await mkdir(join(directory, 'assets/fonts'), { recursive: true });
    await writeFile(join(directory, 'assets/audio/sample.mp3'), Buffer.from('ID3-test-audio'));
    await writeFile(join(directory, 'assets/fonts/sample.ttf'), Buffer.from('font-data'));
    await writeFile(join(directory, 'assets/.private'), 'hidden');
    await writeFile(join(directory, 'backup.json'), 'private backup');
    const module = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [
        { provide: ContentService, useValue: {} },
        { provide: VisitorService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: MediaService, useValue: { content: async () => ({
          record: { mimeType: 'image/png', size: 4 }, stream: Readable.from(Buffer.from('test')),
        }) } },
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.use(helmet());
    serveAssets(app);
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await rm(directory, { recursive: true, force: true });
    if (original === undefined) delete process.env.MEDIA_DIRECTORY;
    else process.env.MEDIA_DIRECTORY = original;
  });
  it('serves public audio with MIME, caching, HEAD and byte ranges', async () => {
    const response = await request(app.getHttpServer()).get('/api/assets/dpo/sample.mp3').expect(200);
    expect(response.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(response.headers['cache-control']).toContain('max-age=3600');
    const head = await request(app.getHttpServer()).head('/api/assets/dpo/sample.mp3').expect(200);
    expect(head.headers['content-length']).toBe('14');
    const range = await request(app.getHttpServer()).get('/api/assets/dpo/sample.mp3').set('Range', 'bytes=0-2').expect(206);
    expect(range.headers['content-range']).toBe('bytes 0-2/14');
  });
  it('allows cross-origin images and fonts even with Helmet enabled', async () => {
    const response = await request(app.getHttpServer()).get('/api/assets/dpo/sample.ttf').set('Origin', 'https://frontend.example').expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('serves the organized paths and preserves query strings on original URLs', async () => {
    await request(app.getHttpServer()).get('/api/assets/audio/sample.mp3').expect(200);
    await request(app.getHttpServer()).get('/api/assets/fonts/sample.ttf').expect(200);
    await request(app.getHttpServer()).get('/api/assets/dpo/sample.ttf?v=2').expect(200);
  });
  it('allows public uploaded images to be displayed by a separate admin origin', async () => {
    const response = await request(app.getHttpServer()).get('/api/media/test-file/content').set('Origin', 'http://localhost:8080').expect(200);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(response.headers['content-type']).toMatch(/image\/png/);
  });
  it('does not expose backups, hidden files, missing files, or directory listings', async () => {
    for (const path of ['backup.json', '.private', 'dpo/missing.png', 'dpo/']) {
      const response = await request(app.getHttpServer()).get(`/api/assets/${path}`);
      expect([403, 404]).toContain(response.status);
    }
    const traversal = await request(app.getHttpServer()).get('/api/assets/%2e%2e%2fbackup.json');
    expect([403, 404]).toContain(traversal.status);
  });
});
