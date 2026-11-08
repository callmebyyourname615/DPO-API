import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatDto } from './chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}
  @Post() @HttpCode(200) @Throttle({ default: { limit: 6, ttl: 60000 } })
  reply(@Body() dto: ChatDto) { return this.chat.reply(dto); }
}
