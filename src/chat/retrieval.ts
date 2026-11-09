import { clean, normalize, numerals } from './matching';

const segmenter = new Intl.Segmenter('lo', { granularity: 'word' });
const filler = new Set('a an the is are was were be been what who which how where when why do does did can could would should you your me my tell show give find search download downloads file files document documents pdf number reference about please of and or to i it this that as well if in on for from by have has count there information details website dpo latest recent news articles'.split(' '));
const laoFiller = new Set(['ສປງ', 'ແມ່ນ', 'ຫຍັງ', 'ໃດ', 'ແນວ', 'ແນວໃດ', 'ເທົ່າໃດ', 'ຂໍ', 'ຊ່ວຍ', 'ຢາກ', 'ຮູ້', 'ກ່ຽວກັບ', 'ຂໍ້ມູນ', 'ກະລຸນາ', 'ມີ', 'ບໍ', 'ຂອງ', 'ທີ່', 'ແລະ', 'ຂ່າວ', 'ລ່າສຸດ', 'ຖ້າ', 'ຈະ', 'ເມື່ອ']);
// These are search equivalents, not generated translations or factual answers.
const equivalents: Record<string, string[]> = {
  history: ['ປະຫວັດ'], established: ['ສ້າງຕັ້ງ', 'establishment', 'founded'], founded: ['ສ້າງຕັ້ງ', 'established'],
  structure: ['ໂຄງຮ່າງ'], organization: ['ຈັດຕັ້ງ', 'organisation'], board: ['ສະພາບໍລິຫານ'], directors: ['ສະພາບໍລິຫານ'],
  division: ['ພະແນກ'], divisions: ['ພະແນກ'], departments: ['ພະແນກ'],
  limit: ['ວົງເງິນ', 'maximum', 'ceiling'], maximum: ['ວົງເງິນ', 'limit'], ceiling: ['ວົງເງິນ', 'limit'],
  bank: ['ທະນາຄານ'], member: ['ສະມາຊິກ'], deposit: ['ເງິນຝາກ'], protect: ['ປົກປ້ອງ', 'ຄຸ້ມຄອງ'],
  premium: ['ເບ້ຍປະກັນ'], rate: ['ອັດຕາ'], compensation: ['ຈ່າຍເງິນປົກປ້ອງ', 'payment'],
  cooperation: ['ຮ່ວມມື'], international: ['ສາກົນ'], meeting: ['ປະຊຸມ'], visit: ['ຢ້ຽມຢາມ'],
  korea: ['ເກົາຫຼີ', 'kdic'], japan: ['ຍີ່ປຸ່ນ'], malaysia: ['ມາເລເຊຍ'],
  law: ['ກົດໝາຍ'], decree: ['ດຳລັດ', 'ດໍາລັດ', 'ດໍາລົດ'], agreement: ['ຂໍ້ຕົກລົງ'],
  notice: ['ແຈ້ງການ'], form: ['ແບບພິມ'], guideline: ['ແນະນໍາ', 'ແນະນຳ', 'guidance'],
};

export function keywords(query: string): string[][] {
  const words = [...segmenter.segment(clean(query.replace(/[\u200b-\u200d\ufeff]/g, '')))]
    .filter(part => part.isWordLike && !filler.has(part.segment) && !laoFiller.has(part.segment))
    .map(part => normalize(part.segment)).filter(word => word.length >= 2);
  return [...new Set(words)].map(word => [...new Set([word, ...(equivalents[word] || []).map(normalize)])]);
}

function contains(text: string, term: string, original: string) {
  // A reference number such as 329 must not match 1329 or 3290.
  if (/^\d+$/.test(term)) return new RegExp(`(?:^|[^0-9])${term}(?:$|[^0-9])`).test(numerals(original));
  return text.includes(term);
}

export function passageScore(query: string, text: string) {
  const terms = keywords(query);
  if (!terms.length) return 0;
  const haystack = normalize(text);
  const hits = terms.map(variants => variants.some(term => contains(haystack, term, text)));
  if (terms.some((variants, i) => /^\d+$/.test(variants[0]) && !hits[i])) return 0;
  const coverage = hits.filter(Boolean).length / terms.length;
  return coverage >= 0.8 ? 0.7 + (coverage - 0.8) * 0.4 : 0;
}

export function passages(text: string): string[] {
  return text.split(/\n\s*\n|\f/).flatMap(paragraph => {
    const result: string[] = [];
    // Overlap keeps a sentence crossing a window boundary searchable.
    for (let start = 0; start < paragraph.length; start += 900) result.push(paragraph.slice(start, start + 1200).trim());
    return result.filter(Boolean);
  });
}

export function relevantPassage(query: string, text: string, limit = 1800, context = '') {
  if (text.length <= limit) return text;
  const parts = passages(text);
  const ranked = parts.map((text, index) => ({ text, index, score: passageScore(query, `${context}\n${text}`) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (!ranked[0]?.score) return text.slice(0, limit);
  return ranked.slice(0, 2).filter(item => item.score > 0).sort((a, b) => a.index - b.index).map(item => item.text).join('\n\n…\n\n').slice(0, limit);
}

export function contentScore(query: string, text: string, context = '') {
  return Math.max(0, ...passages(text).map(part => passageScore(query, `${context}\n${part}`)));
}

export const splitQuestions = (text: string) => text.split(/\?\s+(?=\S)|\n+|;\s*|\s+and\s+(?=(?:what|who|how|where|when|which|can|do|does|is|are)\b)|\s+ແລະ\s+(?=(?:ຕິດຕໍ່|ໃຜ|ວົງເງິນ|ສປງແມ່ນ))/iu).map(part => part.trim()).filter(Boolean);
