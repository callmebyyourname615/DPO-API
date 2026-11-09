import 'dotenv/config';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Reader, CountryResponse } from 'maxmind';

async function main() {
  const month = new Date().toISOString().slice(0,7);
  const source = `https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz`;
  const response = await fetch(source,{signal:AbortSignal.timeout(300000)});
  if (!response.ok) throw new Error(`DB-IP download returned ${response.status}; existing database was kept`);
  const bytes = gunzipSync(Buffer.from(await response.arrayBuffer()),{maxOutputLength:64*1024*1024});
  const reader = new Reader<CountryResponse>(bytes);
  if (!reader.get('1.1.1.1')?.country?.iso_code) throw new Error('Country database validation failed');
  const directory = join(process.env.MEDIA_DIRECTORY || './uploads','geoip');
  await mkdir(directory,{recursive:true});
  const destination = join(directory,'country.mmdb');
  await writeFile(`${destination}.tmp`,bytes);
  await rename(`${destination}.tmp`,destination);
  await writeFile(join(directory,'source.json'),JSON.stringify({provider:'DB-IP Lite',month,source,license:'CC BY 4.0',attribution:'https://db-ip.com',sha256:createHash('sha256').update(bytes).digest('hex'),updatedAt:new Date().toISOString()},null,2)+'\n');
  console.log(`Installed DB-IP Lite ${month}: ${bytes.length} bytes. Attribution: https://db-ip.com`);
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
