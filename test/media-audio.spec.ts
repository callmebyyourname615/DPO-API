import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MediaService } from '../src/media/media.service';

describe('audio storage and selection', () => {
  let directory: string;
  const previousDirectory = process.env.MEDIA_DIRECTORY;
  const previousOrigin = process.env.PUBLIC_API_ORIGIN;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'dpo-audio-'));
    process.env.MEDIA_DIRECTORY = directory;
    process.env.PUBLIC_API_ORIGIN = 'http://localhost:3000';
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
    if (previousDirectory === undefined) delete process.env.MEDIA_DIRECTORY;
    else process.env.MEDIA_DIRECTORY = previousDirectory;
    if (previousOrigin === undefined) delete process.env.PUBLIC_API_ORIGIN;
    else process.env.PUBLIC_API_ORIGIN = previousOrigin;
  });
  it.each([
    ['mp3', 'audio/mpeg', Buffer.from('ID3-test-audio')],
    ['mp3', 'audio/mpeg', Buffer.from([0xff, 0xfb, 0x90, 0x64])],
    ['wav', 'audio/wav', Buffer.from('RIFF0000WAVEfmt ')],
    ['wav', 'audio/x-wav', Buffer.from('RIFF0000WAVEfmt ')],
    ['ogg', 'audio/ogg', Buffer.from('OggS-test-audio')],
  ])('uploads %s without overwriting the previous file', async (ext, mimetype, buffer) => {
    const service = new MediaService({ media: { create: jest.fn(async ({ data }) => data) } } as any);
    const file = { originalname: `sound.${ext}`, mimetype, size: buffer.length, buffer };
    const first = await service.upload(file);
    const second = await service.upload(file);
    expect(first.id).not.toBe(second.id);
    expect(await readFile(join(directory, 'media', first.id))).toEqual(buffer);
    expect(await readFile(join(directory, 'media', second.id))).toEqual(buffer);
    expect(first.mimeType).toBe(mimetype === 'audio/x-wav' ? 'audio/wav' : mimetype);
  });
  it('rejects invalid audio signatures, MIME types, and audio over 10 MB', async () => {
    const create = jest.fn();
    const service = new MediaService({ media: { create } } as any);
    const file = { originalname: 'sound.mp3', mimetype: 'audio/mpeg', size: 12, buffer: Buffer.from('not an audio') };
    await expect(service.upload(file)).rejects.toThrow('Unsupported file type');
    await expect(service.upload({ ...file, buffer: Buffer.from('ID3-test'), mimetype: 'image/png' })).rejects.toThrow('Unsupported file type');
    await expect(service.upload({ ...file, buffer: Buffer.from('ID3-test'), size: 10 * 1024 * 1024 + 1 })).rejects.toThrow('Audio must be at most 10 MB');
    expect(create).not.toHaveBeenCalled();
  });
  it('lists uploaded sounds and original audio assets without changing either', async () => {
    await mkdir(join(directory, 'assets', 'audio'), { recursive: true });
    await writeFile(join(directory, 'assets', 'audio', 'original sound.mp3'), 'original');
    await writeFile(join(directory, 'assets', 'audio', 'ignored.txt'), 'ignore');
    const uploaded = { url: 'http://localhost:3000/api/media/new/content', fileName: 'new.mp3' };
    const findMany = jest.fn().mockResolvedValue([uploaded]);
    const service = new MediaService({ media: { findMany } } as any);
    expect(await service.audioOptions()).toEqual([uploaded, { url: '/api/assets/dpo/original%20sound.mp3', fileName: 'original sound.mp3' }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { mimeType: { startsWith: 'audio/' } } }));
    expect(await readFile(join(directory, 'assets', 'audio', 'original sound.mp3'), 'utf8')).toBe('original');
  });
  it('still lists uploads when there is no original audio directory', async () => {
    const uploaded = { url: '/api/media/new/content', fileName: 'new.mp3' };
    const service = new MediaService({ media: { findMany: jest.fn().mockResolvedValue([uploaded]) } } as any);
    expect(await service.audioOptions()).toEqual([uploaded]);
  });
  it('protects uploads used by either footer audio field from deletion', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const url = `http://localhost:3000/api/media/${id}/content`;
    const count = jest.fn().mockResolvedValue(0);
    const siteCount = jest.fn().mockResolvedValue(1);
    const remove = jest.fn();
    const service = new MediaService({
      media: { findUnique: jest.fn().mockResolvedValue({ id, url }), delete: remove },
      news: { count }, document: { count }, faq: { count }, page: { count }, partner: { count }, banner: { count }, homeIntro: { count }, siteSettings: { count: siteCount },
    } as any);
    await expect(service.remove(id)).rejects.toThrow('File is referenced by content');
    expect(siteCount).toHaveBeenCalledWith({ where: { OR: [{ footerAudioUrl: url }, { footerAudioUrl2: url }] } });
    expect(remove).not.toHaveBeenCalled();
  });
});
