import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './content/admin.controller';
import { PublicController } from './content/public.controller';
import { AuthController } from './auth/auth.controller';
import { AdminGuard } from './auth/auth.guard';
import { ContentService } from './content/content.service';
import { VisitorService } from './content/visitor.service';
import { VisitorGeoService } from './content/visitor-geo.service';
import { VisitorAnalyticsService } from './content/visitor-analytics.service';
import { VisitorAnalyticsController, VisitorTrackingController } from './content/visitor-analytics.controller';
import { PrismaService } from './prisma/prisma.service';
import { MediaService } from './media/media.service';
import { UsersController } from './users/users.controller';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '1h', algorithm: 'HS256' } }) }), ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
  controllers: [ChatController, AuthController, UsersController, VisitorAnalyticsController, VisitorTrackingController, AdminController, PublicController],
  providers: [ChatService, PrismaService, ContentService, VisitorService, VisitorGeoService, VisitorAnalyticsService, MediaService, AdminGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
