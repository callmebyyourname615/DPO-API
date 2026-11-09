import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile, access, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

type Upload = { originalname: string; mimetype: string; size: number; buffer: Buffer };
const TYPES: Record<string, { mime: string; matches: (data: Buffer) => boolean }> = {
  jpg: { mime: 'image/jpeg', matches: (b) => b.subarray(0, 3).equals(Buffer.from([0xff,0xd8,0xff])) },
  jpeg: { mime: 'image/jpeg', matches: (b) => b.subarray(0, 3).equals(Buffer.from([0xff,0xd8,0xff])) },
  png: { mime: 'image/png', matches: (b) => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  webp: { mime: 'image/webp', matches: (b) => b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP' },
  pdf: { mime: 'application/pdf', matches: (b) => b.subarray(0,5).toString() === '%PDF-' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', matches: (b) => b.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04])) },
  mp3: { mime: 'audio/mpeg', matches: (b) => b.subarray(0,3).toString() === 'ID3' || (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) },
  wav: { mime: 'audio/wav', matches: (b) => b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WAVE' },
  ogg: { mime: 'audio/ogg', matches: (b) => b.subarray(0,4).toString() === 'OggS' },
};
@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}
  private directory() { return join(process.env.MEDIA_DIRECTORY || './uploads', 'media'); }
  private path(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new NotFoundException();
    return join(this.directory(), id);
  }
  async audioOptions() {
    const directory = join(process.env.MEDIA_DIRECTORY || './uploads', 'assets', 'audio');
    const [entries, uploaded] = await Promise.all([
      readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      }),
      this.prisma.media.findMany({ where: { mimeType: { startsWith: 'audio/' } }, orderBy: { createdAt: 'desc' }, select: { url: true, fileName: true } }),
    ]);
    return [...uploaded, ...entries.filter(entry => entry.isFile() && /\.(mp3|wav|ogg)$/i.test(entry.name)).sort((a,b) => a.name.localeCompare(b.name)).map(entry => ({
      fileName: entry.name,
      url: `/api/assets/dpo/${encodeURIComponent(entry.name)}`,
    }))];
  }
  async upload(file?: Upload) {
    if (!file || !file.size || file.size > 20 * 1024 * 1024) throw new BadRequestException('File is required and must be at most 20 MB');
    let originalName = file.originalname;
    // Multipart filenames arrive as Latin-1 bytes; recover valid UTF-8 without corrupting decoded names.
    if (/^[\u0000-\u00ff]*$/.test(originalName)) {
      const bytes = Buffer.from(originalName, 'latin1');
      const decoded = bytes.toString('utf8');
      if (Buffer.from(decoded, 'utf8').equals(bytes)) originalName = decoded;
    }
    const name = basename(originalName.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(-255);
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const type = TYPES[ext];
    const mime = file.mimetype === 'audio/x-wav' ? 'audio/wav' : file.mimetype;
    if (!type || type.mime !== mime || !type.matches(file.buffer)) throw new BadRequestException('Unsupported file type or invalid file signature');
    if (type.mime.startsWith('audio/') && file.size > 10 * 1024 * 1024) throw new BadRequestException('Audio must be at most 10 MB');
    const origin = process.env.PUBLIC_API_ORIGIN;
    let parsed: URL;
    try { parsed = new URL(origin || ''); } catch { throw new ServiceUnavailableException('PUBLIC_API_ORIGIN is not configured'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new ServiceUnavailableException('PUBLIC_API_ORIGIN must be an HTTP(S) origin');
    const id = randomUUID();
    const path = this.path(id);
    await mkdir(this.directory(), { recursive: true });
    await writeFile(path, file.buffer, { flag: 'wx' });
    try { return await this.prisma.media.create({ data: { id, fileName: name, mimeType: type.mime, size: file.size, url: `${parsed.origin}/api/media/${id}/content` } }); }
    catch (error) { await unlink(path).catch(() => undefined); throw error; }
  }
  async content(id: string) {
    const path = this.path(id);
    const record = await this.prisma.media.findUnique({ where: { id } });
    if (!record) throw new NotFoundException();
    try { await access(path); } catch { throw new NotFoundException(); }
    return { record, stream: createReadStream(path) };
  }
  async remove(id: string) {
    const path = this.path(id);
    const record = await this.prisma.media.findUnique({ where: { id } });
    if (!record) throw new NotFoundException();
    const url = record.url;
    const references = await Promise.all([
      this.prisma.news.count({ where: { OR: [{coverImageUrl: url}, {gallery: {has: url}}, {content: {contains: url}}] } }),
      this.prisma.document.count({ where: { fileUrl: url } }),
      this.prisma.faq.count({ where: { answer: {contains: url} } }),
      this.prisma.page.count({ where: { OR: [{imageUrl: url}, {content: {contains: url}}] } }),
      this.prisma.partner.count({ where: { logoUrl: url } }),
      this.prisma.banner.count({ where: { imageUrl: url } }),
      this.prisma.homeIntro.count({ where: { OR: [{imageUrl: url}, {content: {contains: url}}] } }),
      this.prisma.siteSettings.count({ where: { OR: [{ footerAudioUrl: url }, { footerAudioUrl2: url }] } }),
    ]);
    if (references.some(Boolean)) throw new ConflictException('File is referenced by content');
    await this.prisma.media.delete({ where: { id } });
    await unlink(path).catch(() => undefined);
  }
}
