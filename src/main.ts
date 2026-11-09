import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { serveAssets } from './media/assets';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const proxies = (process.env.TRUSTED_PROXY_CIDRS || '').split(',').map(value=>value.trim()).filter(Boolean);
  if (proxies.length) app.set('trust proxy',proxies);
  app.use(helmet());
  serveAssets(app);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  const origins = (process.env.CORS_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  app.enableCors({ origin: origins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000));
}
void bootstrap();
