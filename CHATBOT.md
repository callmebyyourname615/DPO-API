# DPO website chatbot

`POST /api/chat` answers questions using published FAQ, pages, news, home introduction and contact settings from the existing database. No database migration or new dependency is required. Draft and future news are excluded.

## Enable Gemini

1. Create a Gemini API key at https://aistudio.google.com/api-keys using a project eligible for the Free Tier.
2. To stay on the Free Tier, do not enable Billing or upgrade that project. The application cannot determine the billing tier of an API key. A key from a billed project may incur charges.
3. Set these variables in the API's local `.env` (never in frontend `VITE_*` variables):

   ```dotenv
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

4. Run `npm run build` and restart the API with `npm start`.

Pricing, eligibility and quotas are controlled by Google; check https://ai.google.dev/gemini-api/docs/pricing and the project's active limits before launch. Free-tier prompts and responses may be used to improve Google's products. The chat UI tells visitors not to send personal or account details.

## Behaviour and limits

- No key, exhausted quota, timeout or invalid AI output: return clearly labelled website-search passages. There is one provider call, no automatic retry and no paid-provider fallback.
- The browser sends at most six recent messages, each limited to 2,000 characters, plus a question of up to 500 characters. Conversations remain in page memory; this API does not store them.
- Each source link and excerpt comes from the server's retrieved records. Unknown model source IDs are rejected. Citations do not guarantee that every generated claim is correct; review Lao, Thai and English answers before public launch.
- Live context is capped at about 28,000 characters, including up to 5,000 characters per source. Larger collections need chunking and multilingual semantic retrieval. PDF/file contents and third-party websites are not indexed.
- The endpoint uses the existing application throttle guard with six requests per minute per client. It does not enforce the provider's project-wide daily quota or prove that a key is on the Free Tier.
- The cookie banner was removed at the owner's request; visitor tracking and maps retain the website's previous behaviour.

## Verify without contacting Gemini or changing the database

```sh
npm run build
npm test -- --runTestsByPath test/chat.spec.ts
```

The focused tests mock database reads and provider responses, including quota exhaustion, invalid citations and HTTP input validation.
