# منصة الأرشفة العلمية عبر تليجرام

Enterprise-grade Telegram platform for archiving, classifying and searching scientific
content published in Telegram channels.

## Architecture (Clean Architecture)

```text
src/
  config/          environment-only configuration (nothing hardcoded)
  core/            logger, error hierarchy
  domain/          entities and value types
  infrastructure/
    db/            PostgreSQL pool, migrator, SQL migrations
    repositories/  Repository Pattern (data access only)
  services/        business logic (permissions, extraction, archive, search, stats)
  telegram/        Telegram Bot API client, long-poller, handlers (no business logic)
  app.ts           composition root / dependency injection
  index.ts         process bootstrap, graceful shutdown, global error handlers
```

## Modules

| # | Module | Status |
|---|--------|--------|
| 1 | Telegram Core | implemented |
| 2 | Channel Management | implemented |
| 3 | Administrator Management | implemented |
| 4 | Permission System (RBAC) | implemented |
| 5 | Scientific File Management | implemented |
| 6 | Archive System | implemented |
| 7 | Search Engine | implemented |
| 8 | Scientific Indexing | implemented (GIN full-text) |
| 9 | Hashtag Management | implemented (extract + generate) |
| 10 | Statistics | implemented |
| 11 | Reports (PDF/Excel) | next step |
| 12 | Settings | implemented |
| 13 | Activity Logs | implemented |

## Requirements

- Node.js 20+
- External PostgreSQL (Neon, Supabase PostgreSQL, or self-hosted). The Lovable built-in
  database is not used anywhere.

## Environment variables

Copy `.env.example` to `.env`:

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `DATABASE_URL` | External PostgreSQL connection string |
| `OWNER_ID` | Numeric Telegram id of the owner (permanent full access) |
| `ARCHIVE_CHANNEL_ID` | Default archive channel id |
| `LOG_LEVEL` | `error` \| `warn` \| `info` \| `debug` |

## Run locally

```bash
cd bot
npm install
cp .env.example .env    # fill in the values
npm run migrate
npm run dev
```

## Deploy

- **Docker**: `docker build -t sci-bot ./bot && docker run --env-file bot/.env sci-bot`
- **Render**: `bot/render.yaml` defines a background worker; set the env vars in the dashboard.
- **Oracle Cloud / any VM**: `npm ci && npm run build && npm start` under systemd or Docker.

Migrations run automatically at startup, so deployment requires no code changes.

## Bot commands

`/start` `/help` `/addchannel` `/channels` `/setarchive` `/channelstatus`
`/addadmin` `/admins` `/assign` `/search` `/stats` `/tags` `/logs` `/settings`

Search supports filters: `/search فيزياء type:pdf tag:محاضرة from:2024-01-01 channel:3`

## Guarantees

- Duplicate protection on `(channel_id, message_id)` and on `telegram_file_unique_id`.
- Every command is validated before it reaches the service layer.
- `BOT_TOKEN` / `DATABASE_URL` are never logged (logger redacts them).
- Global error handling: failed updates are logged, the poller keeps running.
