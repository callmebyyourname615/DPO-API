import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, DocumentCategory } from '@prisma/client';
import { localAsset } from './asset-urls';

const prisma = new PrismaClient();
const data = (file: string): any => JSON.parse(readFileSync(join(__dirname, 'seed-data', `${file}.json`), 'utf8'));
const isoDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value);
  if (!match) return null;
  const date = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
};
const fileBytes = (value?: string): number | null => {
  const match = /([\d.]+)\s*(KB|MB|GB|B)/i.exec(value || '');
  if (!match) return null;
  const units: Record<string,number> = {B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3};
  return Math.round(Number(match[1]) * units[match[2].toUpperCase()]);
};
async function main() {
  const assets = data('assets');
  const news = data('news');
  const excerpts = data('news-excerpts');
  const body = data('dporaw');
  await prisma.news.createMany({ data: news.map((n: any, i: number) => ({
    id: `legacy-news-${n.slug}`, title: n.title, slug: n.slug, category: 'news',
    excerpt: excerpts[i] || '', content: i === 0 ? body.join('\n\n') : '',
    coverImageUrl: localAsset(assets[`article.${n.slug}.photo-1`]?.source),
    gallery: i === 0 ? [2,3,4,5].map((x) => localAsset(assets[`article.dporaw.photo-${x}`]?.source)).filter((url): url is string => Boolean(url)) : [],
    publishedAt: isoDate(n.date), status: i === 0 ? 'published' : 'draft',
  })), skipDuplicates: true });
  await prisma.faq.createMany({ data: data('faq').map((f: any, i: number) => ({
    id: `legacy-faq-${i + 1}`, question: f.question.replace(/^\d+\.\s*/, ''),
    answer: f.answer.map((x: any) => x.text).join('\n'), order: i + 1,
    status: [2,11].includes(i) ? 'draft' : 'published',
  })), skipDuplicates: true });
  const categoryMap: Record<string, DocumentCategory> = { decisions:'agreement', notices:'notice', forms:'form', guidance:'guideline' };
  const legal = data('legal-documents');
  const collections: [DocumentCategory, any[]][] = [
    ['decree', data('decrees')], ...Object.entries(categoryMap).map(([key, category]) => [category, legal[key]] as [DocumentCategory, any[]]),
    ['fsnp', data('fsnp')], ['general', data('information').map((d: any) => ({...d, download: `https://www.dpo.gov.la/wp-admin/admin-ajax.php?juwpfisadmin=false&action=wpfd&task=file.download&wpfd_category_id=86&wpfd_file_id=${d.id}&token=&preview=1`}))],
  ];
  for (const [category, docs] of collections) await prisma.document.createMany({ data: docs.map((d: any) => {
    const type = d.ext === 'xlsx' || d.local?.endsWith('.xlsx') ? 'xlsx' : 'pdf';
    return { id: `legacy-document-${d.id}`, title: d.title, category, documentDate: isoDate(d.dates?.[0]), fileUrl: localAsset(d.download), fileName: `${d.id}.${type}`, fileType: type, fileSize: fileBytes(d.size), fileStatus: d.download ? 'available' : 'missing', status: 'published' };
  }), skipDuplicates: true });
  await prisma.partner.createMany({ data: data('partners').map((p: any, i: number) => ({id: `legacy-partner-${p.id}`, name: p.text[0], logoUrl: localAsset(assets[`connections.partner-${p.id}.logo`]?.source), url: p.url, address: p.text.slice(1).join(' · '), order: i, status: 'published'})), skipDuplicates: true });
  await prisma.banner.createMany({ data: [1,2,3,4,5].map((n) => ({id: `legacy-banner-${n}`, title: `DPO ${n}`, imageUrl: localAsset(assets[`home.hero-${n}`]?.source), order: n, status: 'published'})), skipDuplicates: true });
  const duties = data('duties');
  const history = data('content').history;
  await prisma.page.createMany({ data: [
    {id:'legacy-page-mission', title:'ພາລະບົດບາດ ແລະ ໜ້າທີ່', slug:'mission', content:[duties.intro,...duties.items].join('\n\n'), imageUrl: localAsset(assets['institutional.duties.photo-1']?.source), status:'published'},
    {id:'legacy-page-history', title:'ປະຫວັດຄວາມເປັນມາ', slug:'history', content:history.map((v:any)=>v.text).filter(Boolean).join('\n\n'), imageUrl: localAsset(assets['institutional.history.photo-1']?.source), status:'published'},
  ], skipDuplicates:true });
  await prisma.siteSettings.upsert({ where:{id:'main'}, update:{}, create:{id:'main',email:'info@dpo.gov.la',phone:'+85621-330005',address:'ຊັ້ນ 4 ຕຶກສຳນັກງານ ຄະນະກຳມະການຄຸ້ມຄອງຫຼັກຊັບ, ຖະໜົນໄກສອນພົມວິຫານ, ບ້ານໂພນສະອາດ, ເມືອງໄຊເສດຖາ, ນະຄອນຫຼວງວຽງຈັນ, ສປປ ລາວ.', facebookUrl:'https://www.facebook.com/dpolaos',youtubeUrl:'https://www.youtube.com/@dpolaos',mapEmbedUrl:assets['footer.map']?.src || ''} });
  console.log('Source snapshots imported. Existing records were not updated. FAQ 3 and 12 and incomplete articles are drafts pending review.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
