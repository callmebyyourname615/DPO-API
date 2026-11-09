import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { assetRelativePath } from './storage';

/** Only the imported public asset directory is exposed; uploads and backups stay private. */
export function serveAssets(app: NestExpressApplication) {
  app.use((request: Request, _response: Response, next: NextFunction) => {
    request.url = request.url.replace(/^\/api\/assets\/([^?]*)/, (_match, path: string) => `/api/assets/${assetRelativePath(path)}`);
    next();
  });
  app.useStaticAssets(resolve(process.env.MEDIA_DIRECTORY || './uploads', 'assets'), {
    prefix: '/api/assets/',
    dotfiles: 'deny', index: false, redirect: false, maxAge: '1h',
    setHeaders(response) {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      response.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
}
