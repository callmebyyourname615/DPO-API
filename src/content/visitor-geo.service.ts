import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { isIP } from 'node:net';
import { open, Reader, CountryResponse } from 'maxmind';
import type { Request } from 'express';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

@Injectable()
export class VisitorGeoService implements OnModuleInit {
  private reader?: Reader<CountryResponse>;
  private readonly logger = new Logger(VisitorGeoService.name);
  async onModuleInit() {
    const path = process.env.GEOIP_DATABASE_PATH || join(process.env.MEDIA_DIRECTORY || './uploads','geoip','country.mmdb');
    if (!existsSync(path)) return;
    try { this.reader = await open<CountryResponse>(path, { watchForUpdates: true, watchForUpdatesNonPersistent: true }); }
    catch { this.logger.error('Country database could not be loaded; country lookup will use Unknown until configured.'); }
  }
  mode() {
    return this.reader ? 'geoip' : process.env.ANALYTICS_COUNTRY_HEADER === 'cf-ipcountry' && !!process.env.TRUSTED_PROXY_CIDRS ? 'trusted-proxy' : 'unconfigured';
  }
  source() {
    return this.reader ? { provider: this.reader.metadata.databaseType, updatedAt: this.reader.metadata.buildEpoch } : null;
  }
  country(request: Request): string {
    const peer = request.socket.remoteAddress || '';
    const trust = request.app.get('trust proxy fn') as ((address: string, hop: number) => boolean) | undefined;
    if (process.env.ANALYTICS_COUNTRY_HEADER === 'cf-ipcountry' && trust?.(peer, 0)) {
      const code = request.get('cf-ipcountry') || '';
      if (/^[A-Z]{2}$/.test(code) && !['XX', 'T1'].includes(code)) return code;
    }
    const ip = (request.ip || peer).replace(/^::ffff:/, '');
    if (!isIP(ip)) return 'ZZ';
    return this.reader?.get(ip)?.country?.iso_code || 'ZZ';
  }
}
