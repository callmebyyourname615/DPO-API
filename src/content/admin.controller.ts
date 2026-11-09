import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AdminGuard, Roles } from '../auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from '../media/media.service';
import { ContentService, validateInput } from './content.service';

function singletonBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const { id, createdAt, updatedAt, ...editable } = body as Record<string, unknown>;
  return editable;
}
import { HomeIntroDto, ListQueryDto, SettingsDto, SlugQueryDto } from '../common/dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly content: ContentService, private readonly media: MediaService) {}
  @Get('stats') stats() { return this.content.stats(); }
  @Get('home/intro') intro() { return this.content.intro(); }
  @Patch('home/intro') @Roles('admin','editor') updateIntro(@Body() body: unknown) { return this.content.updateSingleton('intro', validateInput(HomeIntroDto, singletonBody(body)) as Record<string, unknown>); }
  @Get('site-settings') settings() { return this.content.settings(); }
  @Patch('site-settings') @Roles('admin') updateSettings(@Body() body: unknown) { return this.content.updateSingleton('settings', validateInput(SettingsDto, singletonBody(body)) as Record<string, unknown>); }
  @Get('home/banners') banners(@Query() q: ListQueryDto) { return this.content.list('banners', q); }
  @Post('home/banners') @Roles('admin','editor') createBanner(@Body() body: unknown) { return this.content.create('banners', body); }
  @Get('home/banners/:id') banner(@Param('id') id: string) { return this.content.get('banners', id); }
  @Patch('home/banners/:id') @Roles('admin','editor') updateBanner(@Param('id') id: string, @Body() body: unknown) { return this.content.update('banners', id, body); }
  @Delete('home/banners/:id') @Roles('admin','editor') @HttpCode(204) deleteBanner(@Param('id') id: string) { return this.content.remove('banners', id); }
  @Post('media/upload') @Roles('admin','editor') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  upload(@UploadedFile() file: any) { return this.media.upload(file); }
  @Get('media/audio-options')
  audioOptions() { return this.media.audioOptions(); }
  @Delete('media/:id') @Roles('admin','editor') @HttpCode(204)
  deleteMedia(@Param('id') id: string) { return this.media.remove(id); }
  @Get(':resource/slug-check') slugCheck(@Param('resource') resource: string, @Query() q: SlugQueryDto) {
    if (resource !== 'news' && resource !== 'pages') throw new NotFoundException();
    return this.content.slugAvailable(resource, q.slug, q.excludeId);
  }
  @Get(':resource') list(@Param('resource') resource: string, @Query() q: ListQueryDto) { return this.content.list(resource, q); }
  @Post(':resource') @Roles('admin','editor') create(@Param('resource') resource: string, @Body() body: unknown) { return this.content.create(resource, body); }
  @Get(':resource/:id') get(@Param('resource') resource: string, @Param('id') id: string) { return this.content.get(resource, id); }
  @Patch(':resource/:id') @Roles('admin','editor') update(@Param('resource') resource: string, @Param('id') id: string, @Body() body: unknown) { return this.content.update(resource, id, body); }
  @Delete(':resource/:id') @Roles('admin','editor') @HttpCode(204) remove(@Param('resource') resource: string, @Param('id') id: string) { return this.content.remove(resource, id); }
}
