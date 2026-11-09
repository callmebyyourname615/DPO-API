import { ChatService } from '../src/chat/chat.service';
import { english, sourceHash } from '../src/chat/english';
import { contentScore, relevantPassage, splitQuestions } from '../src/chat/retrieval';
import pageFixture = require('./fixtures/chat-pages.json');
import documentFixture = require('./fixtures/chat-documents.json');
import faqFixture = require('../prisma/seed-data/faq.json');

function mockPrisma() {
  return {
    faq: { findMany: jest.fn().mockResolvedValue(faqFixture.map((faq, i) => ({ id: `legacy-faq-${i + 1}`, question: faq.question.replace(/^\d+\.\s*/, ''), answer: faq.answer.map(part => part.text).join('\n') })).filter((_, i) => ![2, 11].includes(i))) },
    page: { findMany: jest.fn().mockResolvedValue(pageFixture) },
    document: { findMany: jest.fn().mockResolvedValue(documentFixture.map(document => ({ ...document, updatedAt: new Date(document.updatedAt), documentDate: document.documentDate ? new Date(document.documentDate) : null }))) },
    partner: { findMany: jest.fn().mockResolvedValue([{ id: 'world-bank', name: 'The World Bank', url: 'https://www.worldbank.org/', phone: '99999999', email: '', address: '' }]) },
    news: { findMany: jest.fn().mockResolvedValue([]) },
    homeIntro: { findUnique: jest.fn().mockResolvedValue(null) },
    siteSettings: { findUnique: jest.fn().mockResolvedValue({ phone: '12345678', email: 'dpo@example.test', address: 'Vientiane', facebookUrl: 'https://www.facebook.com/dpo', youtubeUrl: 'https://www.youtube.com/@dpo' }) },
  };
}

describe('expanded website knowledge', () => {
  it.each([
    ['When was DPO founded?', 'page:legacy-page-history'],
    ['Tell me the history of DPO', 'page:legacy-page-history'],
    ['ສປງສ້າງຕັ້ງເມື່ອໃດ', 'page:legacy-page-history'],
    ['Which divisions does DPO have?', 'page:wordpress-page-2535'],
    ['Show the organizational chart', 'page:wordpress-page-2535'],
    ['DPO board of directors', 'page:wordpress-page-1005'],
    ['What is the deposit protection limit?', 'page:cmw6npu0s0000xp7mnjln5u0d'],
    ['How much is protected?', 'page:cmw6npu0s0000xp7mnjln5u0d'],
    ['How many member banks are there?', 'page:cmw6npu0s0000xp7mnjln5u0d'],
    ['ວົງເງິນປົກປ້ອງເທົ່າໃດ', 'page:cmw6npu0s0000xp7mnjln5u0d'],
  ])('finds %s', async (message, id) => {
    const reply = await new ChatService(mockPrisma() as any).reply({ message });
    expect(reply.sources[0]?.id).toBe(id);
  });
  it('uses source-bound English page translations', async () => {
    const service = new ChatService(mockPrisma() as any);
    const history = await service.reply({ message: 'When was DPO established?' });
    expect(history.answer).toContain('2019');
    expect(history.answer).not.toMatch(/[\u0e80-\u0eff]/u);
    for (const page of pageFixture) expect(english[`page:${page.id}`].sourceHash).toBe(sourceHash(page.title, page.content));
  });
  it('finds a document by its reference number without inventing scanned contents', async () => {
    const reply = await new ChatService(mockPrisma() as any).reply({ message: 'Download agreement 1170' });
    expect(reply.sources[0]?.id).toBe('document:legacy-document-2701');
    expect(reply.answer).toContain('Only the document title is indexed');
  });
  it('returns indexed PDF passages and the correct page reference', async () => {
    const reply = await new ChatService(mockPrisma() as any).reply({ message: 'Article 11 of decree 329' });
    expect(reply.sources[0]?.id).toBe('document:legacy-document-1433');
    expect(reply.sources[0]?.url).toMatch(/#page=\d+$/);
    expect(reply.answer).toContain('Article 11');
    expect(reply.answer).toContain('Gross Domestic Product');
    expect(reply.answer).not.toContain('Article 12');
    expect(reply.answer).toContain('later amendments');
  });
  it('rejects an indexed document after its metadata changes', async () => {
    const prisma = mockPrisma();
    const rows: { id: string; updatedAt: Date }[] = await prisma.document.findMany();
    prisma.document.findMany.mockResolvedValue(rows.filter(document => document.id === 'legacy-document-1433').map(document => ({ ...document, updatedAt: new Date('2030-01-01') })));
    const reply = await new ChatService(prisma as any).reply({ message: 'decree 329' });
    expect(reply.answer).toContain('Only the document title is indexed');
    expect(reply.sources[0]?.url).not.toContain('#page=');
  });
  it('requires available PDF status before using a stored document passage', async () => {
    const prisma = mockPrisma();
    const rows = documentFixture.filter(document => document.id === 'legacy-document-1433').map(document => ({ ...document, updatedAt: new Date(document.updatedAt), documentDate: document.documentDate ? new Date(document.documentDate) : null, fileStatus: 'missing' }));
    prisma.document.findMany.mockResolvedValue(rows);
    const reply = await new ChatService(prisma as any).reply({ message: 'decree 329' });
    expect(reply.answer).toContain('Only the document title is indexed');
    expect(reply.sources[0]?.url).toBe('/ດຳລັດ/');
  });
  it('lists available forms without treating spreadsheets as extracted text', async () => {
    const reply = await new ChatService(mockPrisma() as any).reply({ message: 'Show me the forms' });
    expect(reply.sources.map(source => source.id)).toEqual(['document:legacy-document-2161']);
  });
  it('answers a named partner contact question from that partner', async () => {
    const reply = await new ChatService(mockPrisma() as any).reply({ message: 'World Bank phone number' });
    expect(reply.sources[0]?.id).toBe('partner:world-bank');
    expect(reply.answer).toContain('99999999');
    expect(reply.answer).not.toContain('12345678');
    expect(reply.answer).toContain('does not establish deposit-protection membership');
  });
  it('reads social links from live settings', async () => {
    const reply = await new ChatService(mockPrisma() as any).reply({ message: 'DPO Facebook' });
    expect(reply.answer).toContain('https://www.facebook.com/dpo');
  });
  it('finds news beyond the first 100 records and uses a matching later paragraph', async () => {
    const prisma = mockPrisma();
    prisma.news.findMany.mockResolvedValue(Array.from({ length: 145 }, (_, i) => ({ id: String(i), title: `Office update ${i}`, slug: `article-${i}`, content: i === 144 ? `${'General office information. '.repeat(180)}\n\nLBB cooperation discussed operational coordination.` : 'A general office update.' })));
    const reply = await new ChatService(prisma as any).reply({ message: 'News about LBB cooperation' });
    expect(reply.sources.map(source => source.id)).toEqual(['news:144']);
    expect(reply.sources[0]?.excerpt).toContain('LBB cooperation');
    expect(prisma.news.findMany.mock.calls[0][0]).not.toHaveProperty('take');
  });
  it('filters news by year rather than listing the latest unrelated articles', async () => {
    const prisma = mockPrisma();
    prisma.news.findMany.mockResolvedValue([
      { id: 'new', title: 'Office announcement', slug: 'new', content: 'Annual office meeting.', publishedAt: new Date('2026-03-01') },
      { id: 'old', title: 'Office announcement', slug: 'old', content: 'Annual office meeting.', publishedAt: new Date('2024-03-01') },
    ]);
    const reply = await new ChatService(prisma as any).reply({ message: 'News from 2024' });
    expect(reply.sources.map(source => source.id)).toEqual(['news:old']);
  });
  it('answers separate questions using one published-data read', async () => {
    const prisma = mockPrisma();
    const reply = await new ChatService(prisma as any).reply({ message: 'When was DPO founded? How do I contact DPO?' });
    expect(reply.sources.map(source => source.id)).toEqual(['page:legacy-page-history', 'contact']);
    expect(reply.answer).toContain('Phone: 12345678');
    expect(prisma.page.findMany).toHaveBeenCalledTimes(1);
  });
  it('does not confuse a conjunction within a single question with two questions', () => {
    expect(splitQuestions('Are savings and fixed deposits protected?')).toHaveLength(1);
  });
  it('requires every requested reference number to match exactly', () => {
    expect(contentScore('Decree 329', 'Decree 1329')).toBe(0);
    expect(contentScore('Decree 329', 'Decree 3290')).toBe(0);
  });
  it('does not cite a PDF as an answer to an unknown document number', async () => {
    const reply = await new ChatService(mockPrisma() as any).reply({ message: 'decree 999999' });
    expect(reply.sources).toEqual([]);
  });
  it('keeps later matching text instead of returning an unrelated beginning', () => {
    const text = `${'Unrelated introduction. '.repeat(200)}\n\nInternal audit division performs internal checks.`;
    expect(relevantPassage('internal audit', text)).toContain('performs internal checks');
  });
  it('does not expose unsafe external links', async () => {
    const prisma = mockPrisma();
    prisma.partner.findMany.mockResolvedValue([{ id: 'unsafe', name: 'Unsafe Agency', url: 'javascript:alert(1)', phone: '', email: '', address: '' }]);
    const reply = await new ChatService(prisma as any).reply({ message: 'Unsafe Agency' });
    expect(reply.sources[0]?.url).toBe('/ເຊື່ອມຕໍ່/');
    expect(reply.answer).not.toContain('javascript:');
  });
  it('only requests published documents and partners', async () => {
    const prisma = mockPrisma();
    await new ChatService(prisma as any).reply({ message: 'DPO history' });
    expect(prisma.document.findMany.mock.calls[0][0].where).toEqual({ status: 'published' });
    expect(prisma.partner.findMany.mock.calls[0][0].where).toEqual({ status: 'published' });
  });
});
