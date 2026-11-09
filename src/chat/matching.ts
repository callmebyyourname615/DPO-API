const stopWords = /\b(?:a|an|the|is|are|was|were|what|who|how|do|does|did|can|could|would|you|your|tell|me|about|please|of|and|or|to|i|my|it|this|that|as|well|if|in|for|have|has|hello|hi)\b/g;
const synonyms: Record<string, string> = {
  protected: 'protect', protection: 'protect', protecting: 'protect', protects: 'protect', covered: 'protect', cover: 'protect', coverage: 'protect', insurance: 'protect',
  deposits: 'deposit', accounts: 'deposit', account: 'deposit', fixed: 'term',
  registration: 'register', registering: 'register', enrolment: 'register', enrollment: 'register', signup: 'register',
  companies: 'company', businesses: 'company', business: 'company', corporate: 'company', entities: 'entity',
  members: 'member', membership: 'member', institutions: 'institution', banks: 'bank', premiums: 'premium',
  duties: 'duty', responsibilities: 'duty', functions: 'duty', purpose: 'purpose',
  founded: 'established', establishment: 'established', establishing: 'established', establish: 'established',
  identify: 'check', know: 'check',
  pay: 'payment', pays: 'payment', paid: 'payment', payments: 'payment', paying: 'payment', payout: 'payment', fails: 'failure', closes: 'failure', closed: 'failure',
  cambodia: 'ກຳປູເຈຍ', philippines: 'ຟີລິບປິນ', vietnam: 'ຫວຽດນາມ', thailand: 'ໄທ',
};
export const numerals = (text: string) => text.replace(/[໐-໙]/gu, digit => String(digit.charCodeAt(0) - 0x0ed0));
export function clean(text: string) {
  return numerals(text).normalize('NFKC').toLowerCase()
    .replace(/\b(?:isn't|isnt|aren't|arent|doesn't|doesnt|don't|dont)\b/g, ' not ')
    .replace(/\b(?:sign up|fill in|fill out)\b/g, 'register')
    .replace(/\bstands for\b/g, 'meaning')
    .replace(/\b(website|office|dpo)\s+do\b/g, '$1 purpose')
    .replace(stopWords, '')
    .replace(/[a-z]+/g, word => synonyms[word] || word)
    .replace(/(?:ຂໍຖາມ|ແມ່ນຫຍັງ|ແດ່|ກ່ອນ|ກະລຸນາ|ການ)/gu, '')
    .replace(/ແບບໃດ/gu, 'ປະເພດ')
    .replace(/ປະເພດໃດ/gu, 'ປະເພດ')
    .normalize('NFKC');
}
export const normalize = (text: string) => clean(text).replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const grams = (text: string) => new Set(Array.from({ length: Math.max(0, text.length - 2) }, (_, i) => text.slice(i, i + 3)));
export const negative = (text: string) => /\b(?:not|unprotected|excluded?|excluding|except|isn't|isnt|aren't|arent|doesn't|doesnt|don't|dont)\b|ບໍ່|ຍົກເວັ້ນ/iu.test(text);

function similarity(query: string, phrase: string) {
  const left = normalize(query), right = normalize(phrase);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const mismatch = [...left].findIndex((char, index) => char !== right[index]);
  if (/^[a-z]+$/.test(left + right) && left.length >= 6 && left.length === right.length && mismatch >= 0 && left[mismatch] === right[mismatch + 1] && left[mismatch + 1] === right[mismatch] && left.slice(mismatch + 2) === right.slice(mismatch + 2)) return 0.95;
  const a = grams(left), b = grams(right);
  const overlap = [...a].filter(gram => b.has(gram)).length;
  const dice = a.size + b.size ? 2 * overlap / (a.size + b.size) : 0;
  const words = (value: string) => new Set(clean(value).match(/[a-z]+/g) || []);
  const x = words(query), y = words(phrase);
  const same = [...x].filter(word => y.has(word)).length;
  const wordScore = !/[\u0e80-\u0eff]/u.test(query + phrase) && x.size && y.size ? 2 * same / (x.size + y.size) : 0;
  const contained = left.length >= 4 && right.includes(left) ? 0.88 * left.length / right.length : 0;
  return Math.max(dice, wordScore, contained);
}

export function matchScore(query: string, phrases: string[], body: string, faq: boolean) {
  const normalized = normalize(query);
  if (normalized.length < 3) return 0;
  if ((numerals(query).match(/\d+/g) || []).some(number => !new RegExp(`(?:^|[^0-9])${number}(?:$|[^0-9])`).test(numerals(`${phrases.join(' ')} ${body}`)))) return 0;
  if (faq && negative(query) && !phrases.some(negative)) return 0;
  const eligible = faq && !negative(query) && phrases.some(negative) ? phrases.filter(phrase => !negative(phrase)) : phrases;
  const titleScore = Math.max(0, ...eligible.map(phrase => similarity(query, phrase)));
  const bodyScore = normalized.length >= 8 && normalize(body).includes(normalized) ? 0.7 : 0;
  return Math.max(titleScore, bodyScore);
}

export const isFollowUp = (text: string) => /^(?:tell me more|more(?: details)?(?: please)?|explain more|please explain|ອະທິບາຍເພີ່ມ|ຂໍລາຍລະອຽດເພີ່ມ|ຂໍເພີ່ມ|ເພີ່ມອີກ)[!?.\s]*$/iu.test(text.trim());
