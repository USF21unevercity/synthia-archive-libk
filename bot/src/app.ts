import { loadConfig, type AppConfig } from "./config/env.js";
import { createLogger, type Logger } from "./core/logger.js";
import { createPool, type Database } from "./infrastructure/db/pool.js";
import { runMigrations } from "./infrastructure/db/migrator.js";
import { ChannelRepository } from "./infrastructure/repositories/channel.repository.js";
import { AdminRepository } from "./infrastructure/repositories/admin.repository.js";
import { FileRepository } from "./infrastructure/repositories/file.repository.js";
import { HashtagRepository } from "./infrastructure/repositories/hashtag.repository.js";
import { ArchiveRepository } from "./infrastructure/repositories/archive.repository.js";
import { ActivityLogRepository } from "./infrastructure/repositories/activity-log.repository.js";
import { SettingsRepository } from "./infrastructure/repositories/settings.repository.js";
import { PermissionService } from "./services/permission.service.js";
import { ContentExtractionService } from "./services/content-extraction.service.js";
import { ArchiveService } from "./services/archive.service.js";
import { SearchService } from "./services/search.service.js";
import { StatisticsService } from "./services/statistics.service.js";
import { TelegramClient } from "./telegram/client.js";
import { UpdatePoller } from "./telegram/poller.js";
import { UpdateDispatcher } from "./telegram/handlers/dispatcher.js";
import { buildCommands } from "./telegram/handlers/commands.js";
import { UserRepository } from "./infrastructure/repositories/user.repository.js";
import { ViewRepository } from "./infrastructure/repositories/view.repository.js";
import { MenuController } from "./telegram/handlers/ui.js";
import { RefStore, SessionStore } from "./telegram/handlers/session.js";
import { createHealthServer } from "./http/health-server.js";


export interface Application {
  config: AppConfig;
  logger: Logger;
  pool: Database;
  poller: UpdatePoller;
  telegram: TelegramClient;
  health: ReturnType<typeof createHealthServer>;
}

/** Composition root: every dependency is constructed and injected here. */
export async function createApplication(): Promise<Application> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const pool = createPool(config.databaseUrl, logger.child("db"));

  await runMigrations(pool, logger.child("migrate"));


  const channels = new ChannelRepository(pool);
  const admins = new AdminRepository(pool);
  const files = new FileRepository(pool);
  const hashtags = new HashtagRepository(pool);
  const archiveRepo = new ArchiveRepository(pool);
  const activity = new ActivityLogRepository(pool);
  const settings = new SettingsRepository(pool);

  const telegram = new TelegramClient(config.botToken, logger.child("telegram"));
  const permissions = new PermissionService(admins, config.ownerId);
  const extractor = new ContentExtractionService();
  const archive = new ArchiveService(
    channels,
    files,
    hashtags,
    archiveRepo,
    activity,
    extractor,
    telegram,
    config.archiveChannelId,
    logger.child("archive"),
  );
  const search = new SearchService(files);
  const statistics = new StatisticsService(channels, files, archiveRepo, hashtags);

  const commands = buildCommands({
    permissions,
    search,
    statistics,
    channels,
    admins,
    activity,
    settings,
    hashtags,
  });

  const dispatcher = new UpdateDispatcher(
    commands,
    permissions,
    archive,
    activity,
    telegram,
    logger.child("dispatch"),
  );

  const poller = new UpdatePoller(
    telegram,
    (update) => dispatcher.dispatch(update),
    logger.child("poller"),
  );

  // Owner always exists and can never be removed.
  await admins.upsert({ telegramUserId: String(config.ownerId), role: "owner" });

  const health = createHealthServer({
    pool,
    telegram,
    logger: logger.child("http"),
    port: config.port,
    startedAt: Date.now(),
    version: "0.1.0",
  });

  return { config, logger, pool, poller, telegram, health };
}

