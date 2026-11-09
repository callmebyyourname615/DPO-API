# Visitor analytics

The public website sends page views to `POST /api/analytics/visitors`. The admin
monitor is `/visitors` on port 8080. It refreshes every 30 seconds while visible;
the operator can pause refresh, enter fullscreen, filter, or export XLSX.

## Metrics

- Page views count accepted page opens, including reloads and SPA navigation.
- Visitors count distinct anonymous browser IDs within the selected period.
  Clearing storage, changing browsers, or using another device creates a new ID.
- Sessions reuse an ID until 30 minutes of inactivity; active interaction extends
  the browser session. Sessions are shared between tabs through local storage.
- Landing pages are the first retained event for each session represented in the
  selected report. Visits crossing the retention boundary may have a partial
  session history.
- Country is the network location of the connecting IP, which can be a VPN or
  proxy exit country. Local/private IPs and unavailable lookups show Unknown.
- Device/browser/OS come from User-Agent and are approximate.
- Referrer retains only the hostname of the session's entry referrer. Same-origin
  entry referrers are treated as Direct. URL query strings and fragments are not
  stored. Browser restrictions can omit external referrers.

The previous `VisitorDaily` and `/api/visitors` footer counter are unchanged.
Their counting method differs from page views and cannot be used to reconstruct
historical countries, sessions, or paths. Detailed charts start with new traffic.

## Database and retention

Deploy using `npm run prisma:generate`, `npm run prisma:migrate`, then build and
restart the API. The migrations only add analytics tables and indexes; no content
records or previous visitor totals are modified.

Event IDs make duplicate delivery idempotent. An atomic PostgreSQL statement
increments daily views and distinct daily visitors/sessions. Daily identity facts
and event details are pruned to 90 local calendar days at startup and hourly.
`VisitorAnalyticsDay` aggregates remain available for the cumulative page-view
total. Unique visitor counts across a period are computed from distinct event
identities, not by adding daily unique counts.

All timestamps in events are stored as UTC, explicitly independent of the
PostgreSQL session timezone. Reports and local day boundaries use Asia/Vientiane.
The previous-period comparison is unavailable when a complete baseline was not
collected or lies outside retention.

Raw IPs and full User-Agents are never written to analytics tables. Visitor IDs
are HMAC hashed server-side; set a stable `ANALYTICS_HASH_SECRET` in production,
or the existing JWT secret is used. The admin table and export expose only the
first 12 characters of the hash. Public submissions are validated, rate limited,
and common bot User-Agents are ignored. This is approximate analytics, not an
identity or fraud detection system.

## Country database

Run `npm run geoip:update` from the API directory to download the current monthly
[DB-IP Country Lite](https://db-ip.com/db/download/ip-to-country-lite) MMDB.
The command validates the database, installs it atomically under
`$MEDIA_DIRECTORY/geoip/country.mmdb`, and writes its source, date, license and
SHA-256 checksum to `source.json`. Keep this private directory on persistent
storage with the rest of uploads. It is outside the public `assets/` directory.
Run the command monthly using the host's scheduler. If downloading fails, the
existing installed database is kept. The API watches successful replacements.
Restart once after the first installation if the API was already running.

DB-IP Lite is licensed CC BY 4.0. The monitor displays its required attribution
link. An alternative compatible database (e.g. GeoLite2 Country) can be selected
using `GEOIP_DATABASE_PATH`; acquire and maintain it according to its own terms.

If the API sits behind a reverse proxy, set `TRUSTED_PROXY_CIDRS` to the actual
trusted proxy IPs/subnets. Do not trust every address. Follow the
[Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/).
For a trusted Cloudflare chain, optionally set
`ANALYTICS_COUNTRY_HEADER=cf-ipcountry`; the last trusted proxy must overwrite
incoming forwarding/country headers and the origin must reject bypass traffic.
Untrusted country headers are ignored and local database lookup is used instead.
No per-visitor request is sent to a third-party geolocation API.

## Reporting API

Authenticated admin, editor and viewer roles can read these endpoints:

- `GET /api/admin/analytics/visitors`: summary, previous period, trend, country,
  page/landing page, device, source, browser and OS breakdowns, collection date,
  country database status and all-time views.
- `GET /api/admin/analytics/visitors/events`: paginated anonymous event history.
- `GET /api/admin/analytics/visitors/export`: an Excel workbook (.xlsx) with typed text cells.

Filters: `from`, `to` (YYYY-MM-DD, last 90 days), `country` (ISO two-letter code,
`ZZ` for Unknown), `device`, and exact `path`. Event pagination uses `page` and
`limit` (10–100). A one-day range has hourly buckets; longer ranges have daily
buckets. The workbook has one Visitors sheet, a styled header row, frozen headings, filters,
wrapped cells, and local Vientiane date/time values. It contains only column
headings and records, without subtitles, notes or tips. Export applies the same filters and caps at 50,000 rows; narrow the date
range when the cap is exceeded.

Tests: `npm test -- --runTestsByPath test/visitor-analytics.spec.ts
test/visitors.spec.ts`. The new integration suite creates and drops its own
random PostgreSQL schema; it does not clear the application schema.
