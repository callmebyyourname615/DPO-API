import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mapping: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'seed-data/asset-urls.json'), 'utf8'));
export function localAsset(url: string | null | undefined): string | null {
  return url ? mapping[url] || url : null;
}
