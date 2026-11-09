import { extname } from 'node:path';

/** Translate the original public URLs to the organized disk layout. */
export function assetRelativePath(path: string): string {
  if (/^(?:favicon(?:-\d+x\d+)?\.(?:ico|png)|apple-touch-icon\.png|android-chrome-\d+x\d+\.png|site\.webmanifest)$/.test(path)) {
    return `icons/${path}`;
  }
  const document = /^dpo\/documents\/([^/]+)$/.exec(path);
  if (document) return `documents/${document[1]}`;
  const legacy = /^dpo\/([^/]+)$/.exec(path);
  if (!legacy) return path;
  const filename = legacy[1];
  const extension = extname(filename).toLowerCase();
  if (['.ttf', '.woff', '.woff2', '.otf'].includes(extension)) return `fonts/${filename}`;
  if (['.mp3', '.wav', '.ogg'].includes(extension)) return `audio/${filename}`;
  if (['.pdf', '.xlsx'].includes(extension)) return `documents/${filename}`;
  if (extension === '.svg' || /^excel\.(?:png|jpg)$/.test(filename)) return `icons/${filename}`;
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) return `images/${filename}`;
  return path;
}
