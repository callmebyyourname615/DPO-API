# DPO website chatbot

`POST /api/chat` searches published FAQs, pages, all published news, document titles and indexed PDF passages, the external-links directory, home introduction and contact settings in the existing DPO database. Draft and scheduled news are excluded. There is no external AI provider, API key or AI API charge.

## Lao and English

- The chat interface, initial greeting and suggestions default to Lao, independently of the website language. There is no language button. Replies follow the user's question automatically: Lao script receives a Lao answer, while English input receives an English answer. The frontend omits an explicit locale from chat requests so the API can infer it.
- `GET /api/chat/suggestions?locale=lo|en` returns published FAQ suggestions in the selected language. The default is Lao.
- Twelve published FAQs and seven pages have prepared English renderings in `src/chat/english.ts`: duties, history, organizational structure, Party structure, board structure, background and the home page protection figures. English and Lao questions can match either language while the answer follows the selected language. Without an explicit locale, the API infers Lao or English from the question.
- English translations are bound to a SHA-256 hash of the original title, a newline and original full body text. If the source is edited, its old translation is not used. New or changed Lao FAQs are omitted from English suggestions until their translations are updated.
- To update a translation, edit its English title, body and optional query aliases. Set `sourceHash` to the SHA-256 of the current published source's `title + "\n" + text`. For FAQs these fields are `question` and `answer`; for pages they are `title` and `content`. The source must remain published to appear in the chatbot.
- News and other untranslated sources retain their original language, with a visible notice in English mode. Contact phone/email values are read live; street addresses retain their original spelling. The source website itself is not translated by this feature.
- Prepared translations are working English renderings, not newly issued official English regulations. Review terminology before public release.

## Conversation and limits

The chatbot handles greetings, thanks, contact questions and recent-news requests in Lao and English. A follow-up such as `Tell me more` or `ອະທິບາຍເພີ່ມ` reuses the last substantive user topic, including repeated follow-ups. A new unrelated question is searched independently. Topic-specific news requests filter articles rather than returning unrelated recent news.

Matching uses prepared bilingual question phrases, Unicode normalization, Lao word segmentation, search equivalents, adjacent English letter transpositions and character similarity. Passage retrieval searches later paragraphs as well as titles and preserves exact document numbers. FAQ title matches take priority over incidental body mentions. Negated FAQ questions are separated from positive questions; specific exception topics such as inactive deposits can also match an exclusion answer without requiring the user to type "not". Similar matches produce a clarification with up to three `choices`; the user can click a choice or reply with its number. Pass the assistant's `choices` back with that history entry to support numbered replies. Choices select a search query, never a trusted answer. Unsupported questions receive guidance to choose a suggestion or contact DPO.

Up to three separately phrased questions in one message are answered independently, using one read of the published corpus. Ordinary answers use one best matching source; news/document lists include up to three sources per question. The combined response may contain up to nine sources. Named external organizations are clearly identified as directory entries, not confirmed DPO member institutions. Contact information and social links come from live settings.

This is a curated retrieval system, not model training or automatic learning. Improve coverage by reviewing unanswered questions and adding appropriate aliases to the source's translation entry; keep factual content in the published database source.

The interface displays a thinking shimmer while a request is pending and reveals replies by complete grapheme clusters, preserving Lao combining marks. Reduced-motion preferences show complete replies immediately.

The browser keeps messages in page memory and sends at most six recent messages of up to 2,000 characters each, with a question of up to 500 characters. This API does not store conversations. The small published corpus is read live without the former 100-record cutoff; replace this scan with a search index when the corpus grows into thousands of records. Private inquiries, user accounts and unpublished records are not queried. Third-party sites, spreadsheet contents and names visible only in chart images are not indexed. The chat does not generate open-ended answers or automatically translate new content.

The existing throttle guard limits replies to six requests per minute per client. No database migration or new dependency is required. `npm run dev` reloads local source changes; production must use an updated compiled release.

## Refresh PDF knowledge

The checked-in `src/chat/document-text.json` contains readable text from three public PDFs: the Lao and English Decree No. 329 and English implementation guidance No. 25. Other published documents remain searchable by title, category and reference number. Scans and legacy-font output are excluded rather than presented as reliable text. They require reviewed OCR before full-text search can cover them.

To refresh the snapshot, install the `pdftotext` command (Poppler), put the current public PDFs in a local directory, then run:

```sh
npm run chat:index -- ./uploads/assets/documents
```

Files are named `<database-id>.pdf`, or `<legacy-number>.pdf` for `legacy-document-<number>` records. The command reads only published, available PDF records, performs no downloads or database writes, and replaces the index atomically. Only run it against files verified to correspond to the current document links. Runtime requests do not need Poppler or access to that local directory.

Each snapshot entry is bound to the document title, file URL and database update timestamp. A changed/unpublished/unavailable document cannot use its former extracted passages. A remote file replaced without a database metadata change is not automatically detected: refresh the source assets and index when replacing files. PDF replies quote dated documents with page references and a reminder to check later amendments; they do not establish that an older document is the current rule.

## API examples

```http
GET /api/chat/suggestions?locale=lo
```

Use `locale=en` for English suggestions. To ask a question with automatic language detection:

```http
POST /api/chat
Content-Type: application/json

{"message":"What is DPO?","history":[]}
```

The response contains `answer`, `mode: "search"`, `sources` and optional `choices`. No authentication or external AI key is required.

## Verify

```sh
npx tsc --noEmit --incremental false
npm test -- --runTestsByPath test/chat.spec.ts test/chat-learning.spec.ts test/chat-coverage.spec.ts
```

Focused tests use mocked database reads and public-content fixtures. They cover bilingual paraphrases, unsupported inputs, exclusions, source freshness, PDF page references, exact document numbers, later paragraphs, news dates, clarification choices, repeated follow-ups, multiple questions, no external requests and HTTP validation. Passing these examples does not establish accuracy on all possible user questions.
