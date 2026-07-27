# SciTelegram Platform — Backend (Bot)

Standalone Node.js 20 service. Clean Architecture, external PostgreSQL only
(Neon-ready). Deployable to Docker, Render, Oracle Cloud or any VPS.

## Layers

```
src/
  config/          environment loading + validation (nothing hardcoded)
  core/            logger (auto-redacts secrets), typed errors
  domain/          entities and business types
  infrastructure/  db pool, migrator, SQL migrations, repositories
  services/        business logic (archive, search, stats, permissions, extraction)
  telegram/        API client, long-poll runner, handlers/dispatcher
  http/            health / readiness / metrics HTTP server
  scripts/         verify.ts pre-flight checks
  app.ts           composition root (dependency injection)
```

## Setup

```bash
cd bot
cp .env.example .env      # fill BOT_TOKEN, DATABASE_URL, OWNER_ID, ARCHIVE_CHANNEL_ID
npm install
npm run migrate           # create all tables on the external PostgreSQL
npm run verify            # checks config + PostgreSQL + schema + Telegram
npm run dev               # or: npm run build && npm start
```

`DATABASE_URL` for Neon must include `?sslmode=require`. SSL is enabled
automatically for every non-localhost host.

## Operational endpoints

| Endpoint   | Purpose                                            |
| ---------- | -------------------------------------------------- |
| `/health`  | liveness — 200 while the process is alive           |
| `/ready`   | readiness — 200 only if PostgreSQL **and** Telegram respond, else 503 |
| `/metrics` | uptime, memory, PostgreSQL pool counters            |

Port comes from `PORT` (default `8080`), so Render/Oracle probes work as-is.

## Migrations

Plain SQL files in `src/infrastructure/db/migrations`, applied in filename
order inside a transaction and recorded in `schema_migrations`. Add a new
feature by dropping in `002_*.sql`; never edit an applied migration.

Current schema (10 tables): `channels`, `admins`, `admin_channels`, `files`,
`archive_logs`, `hashtags`, `file_hashtags`, `settings`, `activity_logs`,
`schema_migrations`, with GIN full-text search over file metadata and a
unique index preventing duplicate Telegram files.

## Deployment

- **Docker**: `docker build -t scibot ./bot && docker run --env-file bot/.env -p 8080:8080 scibot`
- **Render**: `bot/render.yaml` (web service, health check path `/health`)
- **Oracle Cloud / VPS**: same image, or `npm ci && npm run build && npm start`

Migrations run automatically at boot, so a fresh deploy against an empty Neon
database is self-provisioning.
