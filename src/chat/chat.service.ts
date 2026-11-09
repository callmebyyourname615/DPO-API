import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto, ChatMessageDto } from './chat.dto';
import { english, sourceHash, type EnglishTranslation } from './english';
import { isFollowUp, matchScore, negative, normalize, numerals } from './matching';
import { contentScore, keywords, relevantPassage, splitQuestions } from './retrieval';
import documentIndex = require('./document-text.json');
import imageIndex = require('./image-text.json');
import type { IndexedContent } from './indexed-content';

type Locale = 'lo' | 'en';
type Source = { id: string; title: string; url: string; text: string; aliases?: string[]; category?: string; index?: IndexedContent; date?: string };
const indexedDocuments = documentIndex as Record<string, IndexedContent>;
const indexedImages = imageIndex as Record<string, IndexedContent>;
const documentRoutes: Record<string, string> = { decree: '/ດຳລັດ/', agreement: '/ຂໍ້ຕົກລົງ/', notice: '/ແຈ້ງການ/', form: '/ແບບພິມ/', guideline: '/ບົດແນະນໍາ-ແລະ-ຄໍາແນະນໍາ/', fsnp: '/fsnp/', general: '/ຂໍ້ມູນ/' };
const safeUrl = (url: string | null) => url && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : null;
function translation(source: Source): EnglishTranslation | undefined {
  const entry = english[source.id];
  return entry && entry.sourceHash === sourceHash(source.title, source.text) ? entry : undefined;
}
const language = (text: string): Locale => /[\u0e80-\u0eff]/u.test(text) ? 'lo' : 'en';
const displaySource = (source: Source, locale: Locale) => locale === 'en' ? { ...source, ...(translation(source) || {}) } : source;
export type ChatReply = { answer: string; mode: 'search'; choices?: string[]; sources: { id: string; title: string; url: string; excerpt: string; language: Locale }[] };
const faqUrl = '/ຄຳຖາມທີ່ພົບເລື່ອຍ/';
const contactUrl = '/ຕິດຕໍ່/';
function passage(source: Source, locale: Locale, query: string): Source & { method?: string } {
  const display = displaySource(source, locale);
  const parts = source.index?.pages;
  if (parts?.length) {
    const pdf = !source.index?.type || source.index.type === 'pdf';
    const article = numerals(query).match(/\barticle\s+(\d+)\b|ມາດຕາ\s*(\d+)/iu);
    if (article && pdf) {
      const heading = new RegExp(`(?:^|\n)\\s*(?:Article|ມາດຕາ)\\s*${article[1] || article[2]}(?:\\s|[.:])`, 'iu');
      const index = parts.findIndex(text => heading.test(text));
      if (index >= 0) {
        const joined = parts.slice(index, index + 3).join('\n\n');
        const section = joined.slice(joined.search(heading)).trim();
        const next = section.slice(1).search(/\n\s*(?:Article|ມາດຕາ)\s*\d+(?:\s|[.:])/iu);
        const method = source.index?.methods?.slice(index, index + 3).includes('ocr') ? 'ocr' : source.index?.methods?.[index];
        return { ...display, method, url: `${source.url.split('#')[0]}#page=${index + 1}`, text: (next >= 0 ? section.slice(0, next + 1) : section).slice(0, 1800) };
      }
    }
    const ranked = parts.map((text, index) => ({ text, index, score: contentScore(query, text, source.title) })).filter(part => part.text.trim()).sort((a, b) => b.score - a.score || a.index - b.index);
    const selected = ranked[0];
    return { ...display, method: source.index?.methods?.[selected.index], url: pdf ? `${source.url.split('#')[0]}#page=${selected.index + 1}` : source.url, text: relevantPassage(query, selected.text, 1800, source.title) };
  }
  return { ...display, text: relevantPassage(query, display.text) };
}
const citations = (sources: Source[], locale: Locale, query = '') => sources.map(source => {
  const { id, title, url, text, method } = passage(source, locale, query);
  const label = method === 'ocr' ? locale === 'en' ? 'OCR — verify against original. ' : 'OCR — ກວດທຽບຕົ້ນສະບັບ. ' : '';
  return { id, title, url, excerpt: `${label}${text}`.slice(0, 220), language: language(text) };
});

const greeting = /^(?:(?:hello|hi|hey)(?:[ ,]+(?:there|dpo))?|good morning|good afternoon|good evening|ສະບາຍດີ(?:ເດີ|ເຈົ້າ)?)[!?.\s]*$/iu;
const thanks = /^(?:thanks(?: a lot)?|thank you(?: very much)?|ຂອບໃຈ(?:ຫຼາຍໆ|ຫຼາຍ)?)[!?.\s]*$/iu;
const choiceNumber = (text: string) => { const value = text.trim(); return /^[1-3]$/.test(value) ? Number(value) - 1 : ['໑', '໒', '໓'].indexOf(value); };
function selectedTopic(text: string, previous?: ChatMessageDto) {
  const index = choiceNumber(text);
  return index >= 0 && previous?.role === 'assistant' ? previous.choices?.[index] || text : text;
}
function topic(message: string, history: ChatMessageDto[]) {
  if (!isFollowUp(message)) return selectedTopic(message, history.at(-1));
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.role !== 'user' || isFollowUp(item.text) || greeting.test(item.text) || thanks.test(item.text)) continue;
    return selectedTopic(item.text, history[i - 1]);
  }
  return '';
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private async knowledge(locale: Locale): Promise<Source[]> {
    // shortcut: scan the small published corpus live; use a search index when it grows into thousands of records.
    const [faqs, pages, news, settings, intro, documents, partners] = await Promise.all([
      this.prisma.faq.findMany({ where: { status: 'published' }, orderBy: { order: 'asc' }, select: { id: true, question: true, answer: true } }),
      this.prisma.page.findMany({ where: { status: 'published' }, select: { id: true, title: true, slug: true, content: true, imageUrl: true, updatedAt: true } }),
      this.prisma.news.findMany({ where: { status: 'published', OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] }, orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], select: { id: true, title: true, slug: true, excerpt: true, content: true, publishedAt: true } }),
      this.prisma.siteSettings.findUnique({ where: { id: 'main' }, select: { phone: true, email: true, address: true, facebookUrl: true, youtubeUrl: true } }),
      this.prisma.homeIntro.findUnique({ where: { id: 'main' }, select: { title: true, content: true } }),
      this.prisma.document.findMany({ where: { status: 'published' }, orderBy: [{ documentDate: 'desc' }, { id: 'asc' }], select: { id: true, title: true, category: true, fileUrl: true, fileStatus: true, fileType: true, documentDate: true, updatedAt: true } }),
      this.prisma.partner.findMany({ where: { status: 'published' }, orderBy: { order: 'asc' }, select: { id: true, name: true, url: true, phone: true, email: true, address: true } }),
    ]);
    return [
      ...(intro ? [{ id: 'home', title: intro.title || 'DPO — Deposit Protection Office', url: '/', text: intro.content }] : []),
      ...(settings ? [{ id: 'contact', title: locale === 'en' ? 'Contact DPO' : 'ຕິດຕໍ່ ສປງ', url: contactUrl, text: [settings.phone && `${locale === 'en' ? 'Phone' : 'ເບີໂທ'}: ${settings.phone}`, settings.email && `${locale === 'en' ? 'Email' : 'ອີເມວ'}: ${settings.email}`, settings.address && `${locale === 'en' ? 'Address' : 'ທີ່ຢູ່'}: ${settings.address}`, safeUrl(settings.facebookUrl) && `Facebook: ${settings.facebookUrl}`, safeUrl(settings.youtubeUrl) && `YouTube: ${settings.youtubeUrl}`].filter(Boolean).join('\n') }] : []),
      ...faqs.map(item => ({ id: `faq:${item.id}`, title: item.question, url: faqUrl, text: item.answer })),
      ...pages.map(item => ({ id: `page:${item.id}`, title: item.title, url: `/pages/${encodeURIComponent(item.slug)}/`, text: item.content })),
      ...pages.flatMap(item => {
        const indexed = indexedImages[`page:${item.id}`];
        const valid = indexed && item.imageUrl && indexed.sourceHash === sourceHash(item.title, `${item.imageUrl}\n${item.updatedAt.toISOString()}\n${item.content}`);
        return valid ? [{ id: `image:${item.id}`, title: item.title, url: `/pages/${encodeURIComponent(item.slug)}/`, text: indexed.pages.join('\n\n'), aliases: indexed.aliases, category: item.slug, index: indexed }] : [];
      }),
      ...news.map(item => ({ id: `news:${item.id}`, title: item.title, url: `/${encodeURIComponent(item.slug)}/`, text: item.content || item.excerpt, date: item.publishedAt?.toISOString().slice(0, 10) })),
      ...documents.map(item => {
        const indexed = indexedDocuments[item.id];
        const valid = indexed && item.fileStatus === 'available' && (indexed.type || 'pdf') === item.fileType && indexed.sourceHash === sourceHash(item.title, `${item.fileUrl}\n${item.updatedAt.toISOString()}`);
        return { id: `document:${item.id}`, title: item.title, category: item.category, url: item.fileStatus === 'available' && safeUrl(item.fileUrl) || documentRoutes[item.category], text: valid ? indexed.pages.join('\f') : item.title, index: valid ? indexed : undefined, date: item.documentDate?.toISOString().slice(0, 10) };
      }),
      ...partners.map(item => ({ id: `partner:${item.id}`, title: item.name, url: safeUrl(item.url) || '/ເຊື່ອມຕໍ່/', text: [item.name, item.phone, item.email, item.address, safeUrl(item.url)].filter(Boolean).join('\n'), aliases: /International Association of Deposit Insurers/i.test(item.name) ? ['IADI'] : [] })),
    ].filter(item => item.text.trim());
  }

  async suggestions(locale: Locale) {
    const faqs = await this.prisma.faq.findMany({ where: { status: 'published' }, orderBy: { order: 'asc' }, select: { id: true, question: true, answer: true } });
    return faqs.flatMap(faq => {
      const source = { id: `faq:${faq.id}`, title: faq.question, text: faq.answer, url: faqUrl };
      if (locale === 'en' && language(faq.answer) === 'lo' && !translation(source)) return [];
      const display = displaySource(source, locale);
      return [{ id: faq.id, question: display.title, answer: display.text, language: language(display.text) }];
    });
  }

  async reply(dto: ChatDto, corpus?: Source[]): Promise<ChatReply> {
    const message = dto.message.trim();
    const history = dto.history ?? [];
    const previousLanguage = history.filter(item => item.role === 'user' && /[a-z\u0e80-\u0eff]/iu.test(item.text)).at(-1)?.text || 'ສະບາຍດີ';
    const locale = dto.locale || language(/[a-z\u0e80-\u0eff]/iu.test(message) ? message : previousLanguage);
    const en = locale === 'en';
    const defaults = en ? ['What is DPO?', 'How do I contact DPO?', 'Latest news'] : ['ສປງແມ່ນຫຍັງ?', 'ຕິດຕໍ່ ສປງ ໄດ້ແນວໃດ?', 'ຂ່າວລ່າສຸດ'];
    const ask = (answer: string, choices = defaults): ChatReply => ({ answer, choices, mode: 'search', sources: [] });
    const clarification = en ? 'Which topic would you like to know about? Choose a question below, or type a more specific question.' : 'ທ່ານຕ້ອງການຮູ້ເລື່ອງໃດ? ເລືອກຄຳຖາມດ້ານລຸ່ມ ຫຼື ພິມລາຍລະອຽດເພີ່ມ.';
    const questions = splitQuestions(message);
    if (questions.length > 3) return ask(en ? 'Please ask up to three questions at a time so I can show a source for each answer.' : 'ກະລຸນາຖາມບໍ່ເກີນ 3 ຄຳຖາມຕໍ່ຄັ້ງ ເພື່ອໃຫ້ສະແດງແຫຼ່ງຂໍ້ມູນໄດ້ຊັດເຈນ.');
    if (questions.length > 1) {
      const shared = corpus || await this.knowledge(locale);
      const replies = await Promise.all(questions.map(message => this.reply({ ...dto, message, locale }, shared)));
      return { answer: replies.map((reply, index) => `${index + 1}. ${questions[index]}\n${reply.answer}`).join('\n\n'), mode: 'search', sources: [...new Map(replies.flatMap(reply => reply.sources).map(source => [source.id, source])).values()], choices: [...new Set(replies.flatMap(reply => reply.choices || []))].slice(0, 3) };
    }
    if (greeting.test(message)) return ask(en ? 'Hello! I can help you find information about DPO, deposit protection, member institutions, recent news and contact details. What would you like to know?' : 'ສະບາຍດີ! ຂ້ອຍຊ່ວຍຄົ້ນຫາຂໍ້ມູນກ່ຽວກັບ ສປງ, ການປົກປ້ອງເງິນຝາກ, ສະມາຊິກ, ຂ່າວສານ ແລະ ການຕິດຕໍ່ໄດ້. ທ່ານຕ້ອງການຮູ້ເລື່ອງໃດ?');
    if (thanks.test(message)) return { answer: en ? 'You are welcome! Is there anything else about DPO you would like to know?' : 'ຍິນດີ! ທ່ານມີຄຳຖາມອື່ນກ່ຽວກັບ ສປງ ບໍ?', mode: 'search', sources: [] };
    if (/\b(?:my|personal)\b.*\b(?:balance|password|transactions?|account number)\b|\breset\b.*\bpassword\b|ຍອດເງິນ.*ຂອງຂ້ອຍ|ລະຫັດຜ່ານ.*ຂອງຂ້ອຍ/iu.test(message)) return ask(en ? 'I cannot access personal bank accounts, balances or passwords. I can help with public information from the DPO website.' : 'ຂ້ອຍບໍ່ສາມາດເຂົ້າເບິ່ງບັນຊີ, ຍອດເງິນ ຫຼື ລະຫັດຜ່ານສ່ວນຕົວ. ຂ້ອຍຊ່ວຍຄົ້ນຫາຂໍ້ມູນສາທາລະນະຈາກເວັບ ສປງ ໄດ້.');
    if (/^(?:help|menu|yes|ok|ຊ່ວຍ|ຊ່ວຍແດ່|ແມ່ນ|ໄດ້)[!?.\s]*$/iu.test(message)) return ask(clarification);
    const query = topic(message, history);
    if (!normalize(query)) return ask(clarification);
    const sources = corpus || await this.knowledge(locale);
    const memberImage = sources.find(source => source.category === 'home-members' && source.index?.methods?.includes('reviewed') && source.index.names?.length);
    const memberTopic = /\b(?:members?|protect(?:ion|ed)?|covered)\b|ສະມາຊິກ|ປົກປ້ອງ|ຄຸ້ມຄອງ/iu.test(query);
    const memberNames = memberImage?.index?.names?.filter(name => new RegExp(`(?:^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'iu').test(query)) || [];
    const memberList = /\b(?:list|names|which banks)\b|ລາຍຊື່|ທະນາຄານໃດ/iu.test(query);
    if (memberImage && memberTopic && (memberNames.length || memberList)) return {
      answer: en ? `These names appear in the member-logo image published on the DPO website:\n${(memberNames.length ? memberNames : memberImage.index!.names!).join(', ')}\nThis is a partial transcription of readable logos in a website snapshot. Confirm the complete current membership list with DPO.` : `ຊື່ເຫຼົ່ານີ້ປາກົດຢູ່ໃນຮູບສັນຍາລັກສະມາຊິກໃນເວັບ ສປງ:\n${(memberNames.length ? memberNames : memberImage.index!.names!).join(', ')}\nນີ້ແມ່ນການຖອດຊື່ສັນຍາລັກທີ່ອ່ານໄດ້ບາງສ່ວນຈາກຮູບໃນເວັບ. ກະລຸນາຢັ້ງຢືນລາຍຊື່ສະມາຊິກປັດຈຸບັນທີ່ຄົບຖ້ວນກັບ ສປງ.`,
      mode: 'search', sources: citations([memberImage], locale, query),
    };
    const partnerQuery = query.replace(/\b(?:contact|phone|telephone|email|address|location|number)\b|ຕິດຕໍ່|ເບີໂທ|ອີເມວ|ທີ່ຢູ່/giu, '');
    const partner = sources.filter(source => source.id.startsWith('partner:')).map(source => ({ source, score: matchScore(partnerQuery, [source.title, ...(source.aliases || [])], '', false) })).sort((a, b) => b.score - a.score)[0];
    if (partner?.score >= 0.85) return {
      answer: en ? `This organization is listed in the website's external links directory. This listing does not establish deposit-protection membership.\n${partner.source.text}` : `ໜ່ວຍງານນີ້ຢູ່ໃນໜ້າເຊື່ອມຕໍ່ເວັບ. ລາຍການນີ້ບໍ່ແມ່ນການຢັ້ງຢືນສະມາຊິກ ສປງ.\n${partner.source.text}`,
      mode: 'search', sources: citations([partner.source], locale, query),
    };
    const contact = sources.find(source => source.id === 'contact');
    if (contact && /\b(?:contact|phone|telephone|email|address|location|facebook|youtube)\b|ຕິດຕໍ່|ເບີໂທ|ອີເມວ|ທີ່ຢູ່/iu.test(query)) {
      return { answer: `${contact.title}\n${contact.text}`, mode: 'search', sources: citations([contact], locale) };
    }
    let news = sources.filter(source => source.id.startsWith('news:'));
    const requestingNews = /\b(?:news|articles|updates)\b|ຂ່າວ/iu.test(query);
    const latestNews = /^(?:(?:show|give|tell)\s+me\s+)?(?:(?:the|dpo|latest|recent|published)\s+)*news[!?.\s]*$/iu.test(query) || /^(?:ຂ່າວ(?:ລ່າສຸດ|ໃໝ່|ສານ)?(?:ຂອງ|ສປງ|\s)*)$/u.test(query.trim()) || requestingNews && !keywords(query).length;
    const newsTopic = latestNews ? undefined : query.match(/\b(?:news|articles)\s+(?:about|on|from|regarding)\s+(.+)/iu)?.[1] || query.match(/ຂ່າວ.*ກ່ຽວກັບ\s*(.+)/u)?.[1] || (requestingNews ? query : undefined);
    if (newsTopic) news = news.map(source => ({ source, score: Math.max(matchScore(newsTopic, [source.title], source.text, false), contentScore(newsTopic, source.text, `${source.title} ${source.date || ''}`)) })).filter(item => item.score >= 0.66).sort((a, b) => b.score - a.score).map(item => item.source);
    if ((latestNews || newsTopic) && news.length) return {
      answer: en ? latestNews ? 'Here are the latest published DPO news articles. Open a source link to read the article.' : 'Here are DPO news articles matching your topic.' : latestNews ? 'ນີ້ແມ່ນຂ່າວລ່າສຸດທີ່ເຜີຍແຜ່ຂອງ ສປງ.' : 'ນີ້ແມ່ນຂ່າວ ສປງ ທີ່ກ່ຽວຂ້ອງກັບຄຳຖາມຂອງທ່ານ.',
      mode: 'search', sources: citations(news.slice(0, 3), locale, newsTopic || query),
    };
    const documentRequest = /\b(?:documents?|pdf|downloads?|decrees?|agreements?|regulations?|guidelines?|notices?|forms)\b|ເອກະສານ|ດາວໂຫລດ|ດຳລັດ|ດໍາລັດ|ດໍາລົດ|ຂໍ້ຕົກລົງ|ແບບພິມ/iu.test(query);
    const categories: [string, RegExp][] = [['decree', /\bdecrees?\b|ດຳລັດ|ດໍາລັດ|ດໍາລົດ/iu], ['agreement', /\bagreements?\b|ຂໍ້ຕົກລົງ/iu], ['notice', /\bnotices?\b|ແຈ້ງການ/iu], ['form', /\bforms?\b|ແບບພິມ/iu], ['guideline', /\bguidelines?\b|ແນະນໍາ|ແນະນຳ/iu], ['fsnp', /\bfsnp\b/iu]];
    const category = documentRequest ? categories.find(([, pattern]) => pattern.test(query))?.[0] : undefined;
    const searchable = newsTopic ? news : documentRequest ? sources.filter(source => source.id.startsWith('document:') && (!category || source.category === category)) : sources.filter(source => !source.id.startsWith('partner:'));
    const documentKeywords = query.replace(/\b(?:show|list|find|download|downloads|documents?|files?|pdf|all|published|available|decrees?|agreements?|notices?|guidelines?|forms)\b|ເອກະສານ|ດາວໂຫລດ|ທັງໝົດ|ແບບພິມ|ດຳລັດ|ຂໍ້ຕົກລົງ/giu, '');
    if (documentRequest && !keywords(documentKeywords).length && searchable.length) return {
      answer: en ? 'These published documents are available on the website. Open a source to view the file or its listing.' : 'ນີ້ແມ່ນເອກະສານທີ່ເຜີຍແຜ່ໃນເວັບ. ເປີດແຫຼ່ງຂໍ້ມູນເພື່ອເບິ່ງໄຟລ໌ ຫຼື ລາຍການເອກະສານ.',
      mode: 'search', sources: citations(searchable.slice(0, 3), locale, query),
    };
    const seen = new Set<string>();
    const ranked = searchable.map(source => {
      const translated = translation(source);
      const phrases = [source.title, ...(source.aliases || []), ...(translated ? [translated.title, ...translated.aliases] : [])];
      const faq = source.id.startsWith('faq:');
      const bodyScore = faq && negative(query) !== phrases.some(negative) ? 0 : contentScore(query, translated?.text || source.text, source.title);
      const titleScore = matchScore(query, phrases, '', faq);
      const supportedTitle = titleScore >= 0.9 || !keywords(query).length || contentScore(query, `${phrases.join(' ')}\n${source.text}\n${translated?.text || ''}`) > 0;
      return { source, score: titleScore >= 0.66 && supportedTitle ? titleScore + 0.12 : bodyScore };
    }).filter(item => {
      const key = normalize(item.source.title + item.source.text);
      if (item.score < 0.66 || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => b.score - a.score || Number(b.source.id.startsWith('faq:')) - Number(a.source.id.startsWith('faq:')) || (en ? Number(language(displaySource(b.source, locale).text) === 'en') - Number(language(displaySource(a.source, locale).text) === 'en') : 0));
    const candidates = ranked.filter(item => item.source.id !== 'home' || !ranked.some(other => other.source.id.startsWith('faq:') && other.score >= item.score - 0.08));
    const close = candidates.filter(item => candidates[0].score - item.score < 0.1);
    const choices = [...new Set(close.map(item => displaySource(item.source, locale).title))].filter(title => !en || language(title) === 'en').slice(0, 3);
    if (close.length > 1 && choices.length > 1) return ask(clarification, choices);
    const matches = candidates.slice(0, 1).map(item => item.source);
    const introduction = en ? 'Here is information from the DPO website.' : 'ຂໍ້ມູນຈາກເວັບ DPO.';
    const missing = en ? 'No matching answer found. Try a shorter keyword or choose a suggested question. You can also contact DPO.' : 'ຍັງບໍ່ພົບຄຳຕອບທີ່ກົງກັນ. ລອງໃຊ້ຄຳສຳຄັນສັ້ນໆ, ເລືອກຄຳຖາມແນະນຳ ຫຼື ຕິດຕໍ່ ສປງ.';
    if (!matches.length) return ask(missing);
    return {
      answer: [introduction, ...matches.map(source => {
        const display = passage(source, locale, query);
        if (source.id.startsWith('document:')) {
          const hasText = source.index?.pages.some(text => text.trim());
          let notice = hasText
            ? en ? 'Document excerpt; check its date and later amendments.' : 'ຂໍ້ຄວາມຈາກເອກະສານ; ກະລຸນາກວດວັນທີ ແລະ ສະບັບປັບປຸງຕໍ່ມາ.'
            : en ? 'Only the document title is indexed. Open the source to read the original file.' : 'ມີພຽງຊື່ເອກະສານໃນຖານຄົ້ນຫາ. ກະລຸນາເປີດແຫຼ່ງຂໍ້ມູນເພື່ອອ່ານໄຟລ໌ຕົ້ນສະບັບ.';
          if (display.method === 'ocr') notice += en ? '\nOCR can misread words and numbers. Verify this excerpt against the original file.' : '\nOCR ອາດອ່ານຄຳສັບ ແລະ ຕົວເລກຜິດ. ກະລຸນາກວດທຽບກັບໄຟລ໌ຕົ້ນສະບັບ.';
          if (display.method === 'spreadsheet') notice += en ? '\nSpreadsheet template: cell values and formulas are quoted, not calculated or live customer data.' : '\nແບບພິມ Excel: ສະແດງຄ່າ ແລະ ສູດໃນຕາຕະລາງ, ບໍ່ແມ່ນຜົນຄຳນວນ ຫຼື ຂໍ້ມູນລູກຄ້າປັດຈຸບັນ.';
          return [`${source.title}${source.date ? ` (${en ? 'listed date' : 'ວັນທີໃນລາຍການ'}: ${source.date})` : ''}`, notice, ...(hasText ? [display.text] : [])].join('\n');
        }
        if (source.id.startsWith('image:')) return `${en ? 'Text read from a website image; verify names and numbers in the original image.' : 'ຂໍ້ຄວາມທີ່ອ່ານຈາກຮູບໃນເວັບ; ກະລຸນາກວດທຽບຊື່ ແລະ ຕົວເລກກັບຮູບຕົ້ນສະບັບ.'}\n${display.text}`;
        if (en && language(display.text) === 'lo') return 'English translation is not available for this source. Open the source link to read the Lao original.';
        return `${display.title}${source.date ? ` (${source.date})` : ''}\n${display.text}`;
      })].join('\n\n'),
      mode: 'search', sources: citations(matches, locale, query),
    };
  }
}
