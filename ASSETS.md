# Public website assets

Public images, fonts, audio, favicons, and documents live in
`$MEDIA_DIRECTORY/assets` (default: `uploads/assets`). The API serves them at
`/api/assets/...`, including HEAD, byte ranges for audio/PDFs, and one-hour caching.
Only this directory is public; uploaded media records and migration backups outside it
continue to use their existing access paths.

```text
uploads/
├── assets/
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   ├── audio/
│   └── documents/
├── media/
└── migrations/
    ├── reports/
    └── backups/
```

Original `/api/assets/dpo/...` and root favicon URLs are translated to these
folders internally. The organized `/api/assets/images/...`, `/fonts/...`, etc.
paths also work. Existing database URLs and frontend links stay valid.
New admin uploads are stored in `media/` and keep their `/api/media/{id}/content` URLs.

Run `npm run uploads:organize` once to organize an existing storage directory.
It preserves bytes, rejects conflicting destinations, removes Finder metadata,
and can be rerun safely. Set `MEDIA_DIRECTORY` to target a different storage root.

## Migration

Run `npm run assets:migrate` from the API directory after configuring `.env`.
The first run copies `../DPO_Frontend/public/assets` and the favicon files, reuses
the source snapshots, and downloads missing DPO assets referenced by the database.
An alternative frontend public directory can be passed after `--`.
It validates downloads, writes `prisma/seed-data/asset-urls.json` for future seeds
and WordPress imports, and updates media URL fields in one transaction only when
all files are available. Re-running reuses files already copied/downloaded.
Source snapshots retain their original URLs as provenance.

The migration report and a timestamped backup of the changed URL fields are saved
under `MEDIA_DIRECTORY/migrations/reports` and `MEDIA_DIRECTORY/migrations/backups`,
respectively, outside the public asset directory. The backup records
each model/id and its `before`/`after` fields. A rollback should restore only those
fields that still equal `after`, to preserve subsequent content edits.

## Deployment

- Copy the entire `uploads` directory to the API host, or mount the same persistent
  volume using `MEDIA_DIRECTORY`. This directory is intentionally excluded from Git.
  Deploying source code alone does not deploy the binary files.
- Route `/api/*` to the API when using the same origin as the website.
- For a separate API origin, set `VITE_DPO_API_BASE_URL` in the frontend before
  building. JSX media URLs, CSS font/background URLs and HTML favicons all use it.
- Keep `PUBLIC_API_ORIGIN` configured for new uploads as before.
- Google Maps embeds and external website links remain external services.
- After changing document URLs, refresh the chat document index with
  `npm run chat:index -- ./uploads/assets/documents` and rebuild/restart the API.
