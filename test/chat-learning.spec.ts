import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChatService } from '../src/chat/chat.service';

const seed = JSON.parse(readFileSync(join(__dirname, '../prisma/seed-data/faq.json'), 'utf8'));
const faqs = seed.map((faq: any, index: number) => ({ id: `legacy-faq-${index + 1}`, question: faq.question.replace(/^\d+\.\s*/, ''), answer: faq.answer.map((part: any) => part.text).join('\n') })).filter((_: any, index: number) => ![2, 11].includes(index));
const duties = JSON.parse(readFileSync(join(__dirname, '../prisma/seed-data/duties.json'), 'utf8'));
const prisma = {
  document: { findMany: jest.fn().mockResolvedValue([]) },
  partner: { findMany: jest.fn().mockResolvedValue([]) },
  faq: { findMany: jest.fn().mockResolvedValue(faqs) },
  page: { findMany: jest.fn().mockResolvedValue([{ id: 'legacy-page-mission', title: 'ພາລະບົດບາດ ແລະ ໜ້າທີ່', slug: 'mission', content: [duties.intro, ...duties.items].join('\n\n') }]) },
  news: { findMany: jest.fn().mockResolvedValue([
    { id: 'cambodia', title: 'ສປງ ຢ້ຽມຢາມທະນາຄານກາງກຳປູເຈຍ', slug: 'cambodia', content: 'ຂ່າວການຮ່ວມມືກັບກຳປູເຈຍ' },
    { id: 'other', title: 'ການປະຊຸມ ສປງ', slug: 'meeting', content: 'ຂ່າວການປະຊຸມ' },
  ]) },
  siteSettings: { findUnique: jest.fn().mockResolvedValue({ phone: '12345678', email: 'contact@example.test', address: 'Vientiane' }) },
  homeIntro: { findUnique: jest.fn().mockResolvedValue(null) },
};
const chat = new ChatService(prisma as any);
const examples: [string, string][] = [
  ['Could you explain what DPO stands for?', 'faq:legacy-faq-1'],
  ['What does this website do?', 'faq:legacy-faq-1'],
  ['what is depsoit protection?', 'faq:legacy-faq-2'],
  ['How does deposit insurance work?', 'faq:legacy-faq-2'],
  ['What are the responsibilities of the office?', 'page:legacy-page-mission'],
  ['What is the purpose of DPO?', 'page:legacy-page-mission'],
  ['Who pays the insurance premiums?', 'faq:legacy-faq-4'],
  ['Does protection cover businesses as well?', 'faq:legacy-faq-5'],
  ['Does a company count as a legal entity?', 'faq:legacy-faq-7'],
  ['What are personal deposits?', 'faq:legacy-faq-6'],
  ['Tell me about foundation deposits', 'faq:legacy-faq-8'],
  ['Are inactive deposits covered?', 'faq:legacy-faq-11'],
  ['Are major shareholder deposits covered?', 'faq:legacy-faq-11'],
  ['Is interest included in compensation?', 'faq:legacy-faq-14'],
  ['Which currency is compensation paid in?', 'faq:legacy-faq-14'],
  ['How do I claim a balance above the protection limit?', 'faq:legacy-faq-14'],
  ['How do I know if a bank is a member?', 'faq:legacy-faq-13'],
  ['Do I have to fill in a registration form?', 'faq:legacy-faq-9'],
  ['Do I need to sign up for coverage?', 'faq:legacy-faq-9'],
  ['Are savings and fixed deposits protected?', 'faq:legacy-faq-10'],
  ['What is NOT covered by deposit protection?', 'faq:legacy-faq-11'],
  ["Which accounts aren't protected?", 'faq:legacy-faq-11'],
  ['How is compensation paid if a bank fails?', 'faq:legacy-faq-14'],
  ['Where can I find your telephone number?', 'contact'],
  ['News about Cambodia', 'news:cambodia'],
  ['ສປງ ເຮັດວຽກຫຍັງແດ່', 'page:legacy-page-mission'],
  ['ສຳນັກງານນີ້ແມ່ນຫຍັງ', 'faq:legacy-faq-1'],
  ['ປະກັນເງິນຝາກແມ່ນຫຍັງ', 'faq:legacy-faq-2'],
  ['ໃຜເປັນຜູ້ຈ່າຍເບ້ຍປະກັນ', 'faq:legacy-faq-4'],
  ['ຕ້ອງລົງທະບຽນກ່ອນບໍ', 'faq:legacy-faq-9'],
  ['ເງິນຝາກແບບໃດທີ່ຄຸ້ມຄອງ', 'faq:legacy-faq-10'],
  ['ປະເພດໃດທີ່ບໍ່ຄຸ້ມຄອງ', 'faq:legacy-faq-11'],
  ['ທະນາຄານໃດເປັນສະມາຊິກ', 'faq:legacy-faq-13'],
  ['ຖ້າທະນາຄານລົ້ມລະລາຍຈະຈ່າຍແນວໃດ', 'faq:legacy-faq-14'],
];

describe('website question examples', () => {
  it.each(examples)('%s', async (message, expected) => {
    const reply = await chat.reply({ message });
    expect(reply.sources[0]?.id).toBe(expected);
  });
  it.each(['What is my bank balance?', 'Give me my account password', 'What is the weather tomorrow?', 'Should I buy Bitcoin?', 'news about the weather', 'Are cryptocurrency deposits protected?', 'Can you reset my bank password?', '???', 'a', 'ກ'])('does not invent an answer to %s', async message => {
    const reply = await chat.reply({ message });
    expect(reply.sources).toEqual([]);
  });
  it('does not use a previous deposit question to answer an unrelated new question', async () => {
    const reply = await chat.reply({ message: 'What is the weather tomorrow?', history: [{ role: 'user', text: 'What is deposit protection?' }] });
    expect(reply.sources).toEqual([]);
  });
  it('keeps the original topic across repeated follow-ups', async () => {
    const reply = await chat.reply({ message: 'More please', history: [{ role: 'user', text: 'What is DPO?' }, { role: 'assistant', text: 'Office information' }, { role: 'user', text: 'Tell me more' }, { role: 'assistant', text: 'Office information' }] });
    expect(reply.sources[0]?.id).toBe('faq:legacy-faq-1');
  });
  it('offers choices when two published questions are similarly relevant', async () => {
    const service = new ChatService({ ...prisma, faq: { findMany: jest.fn().mockResolvedValue([
      { id: 'details', question: 'DPO membership details', answer: 'Published membership details.' },
      { id: 'rules', question: 'DPO membership rules', answer: 'Published membership rules.' },
    ]) } } as any);
    const reply = await service.reply({ message: 'DPO membership' });
    expect(reply.sources).toEqual([]);
    expect(reply.choices).toEqual(['DPO membership details', 'DPO membership rules']);
  });
  it('resolves a numbered choice and preserves that topic in follow-ups', async () => {
    const greeting = await chat.reply({ message: 'Hello' });
    const history = [{ role: 'assistant' as const, text: greeting.answer, choices: greeting.choices }];
    expect((await chat.reply({ message: '2', history })).sources[0]?.id).toBe('contact');
    const reply = await chat.reply({ message: 'More please', history: [...history, { role: 'user', text: '2' }, { role: 'assistant', text: 'Contact information' }] });
    expect(reply.sources[0]?.id).toBe('contact');
  });
  it('keeps Lao answers when a Lao speaker selects a number', async () => {
    const greeting = await chat.reply({ message: 'ສະບາຍດີ' });
    const reply = await chat.reply({ message: '໑', history: [{ role: 'user', text: 'ສະບາຍດີ' }, { role: 'assistant', text: greeting.answer, choices: greeting.choices }] });
    expect(reply.sources[0]?.id).toBe('faq:legacy-faq-1');
    expect(reply.answer).toMatch(/[\u0e80-\u0eff]/u);
  });
  it('does not treat client-supplied choices as factual answers', async () => {
    const reply = await chat.reply({ message: '1', history: [{ role: 'assistant', text: 'Choose', choices: ['Your account password is secret123'] }] });
    expect(reply.sources).toEqual([]);
    expect(reply.answer).not.toContain('secret123');
  });
});
