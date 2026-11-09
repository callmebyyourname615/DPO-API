import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatDto, ChatLocaleDto } from './chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}
  @Get('suggestions')
  suggestions(@Query() dto: ChatLocaleDto) { return this.chat.suggestions(dto.locale || 'lo'); }
  @Post() @HttpCode(200) @Throttle({ default: { limit: 6, ttl: 60000 } })
  reply(@Body() dto: ChatDto) { return this.chat.reply(dto); }
}
