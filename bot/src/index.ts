import { createApplication } from "./app.js";
import { createLogger } from "./core/logger.js";
import { toAppError } from "./core/errors.js";

const bootLogger = createLogger("info", "boot");
let runtimeLogger = bootLogger;
let shuttingDown = false;

// Global safety net: runtime failures are logged and the polling loop is allowed to recover.
process.on("unhandledRejection", (reason) => {
  runtimeLogger.error("Unhandled rejection", { error: toAppError(reason).message });
});
process.on("uncaughtException", (error) => {
  runtimeLogger.error("Uncaught exception", { error: toAppError(error).message });
});

async function main(): Promise<void> {
  const app = await createApplication();
  runtimeLogger = app.logger;
  const me = await app.telegram.getMe();
  app.logger.info("Bot authenticated", { username: me.username, id: me.id });
  await app.telegram.deleteWebhook(false);
  app.logger.info("Telegram polling mode verified; webhook cleared without dropping updates");

  await app.health.listen();

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.logger.info("Shutting down", { signal });
    app.poller.stop();
    await app.health.close().catch(() => undefined);
    await app.pool.end().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.poller.start();
}

main().catch((error) => {
  const appError = toAppError(error);
  bootLogger.error("Fatal startup error", { code: appError.code, error: appError.message });
  process.exit(1);
});
