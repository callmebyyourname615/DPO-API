import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MediaService } from '../src/media/media.service';

describe('uploaded document filenames', () => {
  let directory: string;
  const previousDirectory = process.env.MEDIA_DIRECTORY;
  const previousOrigin = process.env.PUBLIC_API_ORIGIN;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'dpo-filenames-'));
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
    [Buffer.from('ເອກະສານ.pdf', 'utf8').toString('latin1'), 'ເອກະສານ.pdf'],
    ['ເອກະສານ.pdf', 'ເອກະສານ.pdf'],
    [Buffer.from('café.pdf', 'utf8').toString('latin1'), 'café.pdf'],
    ['café.pdf', 'café.pdf'],
    ['report.pdf', 'report.pdf'],
    [Buffer.from('../ເອກະສານ.pdf', 'utf8').toString('latin1'), 'ເອກະສານ.pdf'],
  ])('preserves the intended name for %s', async (originalname, expected) => {
    const create = jest.fn(async ({ data }) => data);
    const service = new MediaService({ media: { create } } as any);
    const buffer = Buffer.from('%PDF-1.4\n%%EOF');
    const result = await service.upload({ originalname, mimetype: 'application/pdf', size: buffer.length, buffer });
    expect(result.fileName).toBe(expected);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ fileName: expected, mimeType: 'application/pdf' }) });
    expect(await readFile(join(directory, 'media', result.id))).toEqual(buffer);
  });
});
