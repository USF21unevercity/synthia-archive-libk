import { createApplication } from "./app.js";
import { createLogger } from "./core/logger.js";
import { toAppError } from "./core/errors.js";

const bootLogger = createLogger("info", "boot");

async function main(): Promise<void> {
  const app = await createApplication();
  const me = await app.telegram.getMe();
  app.logger.info("Bot authenticated", { username: me.username, id: me.id });

  const shutdown = async (signal: string) => {
    app.logger.info("Shutting down", { signal });
    app.poller.stop();
    await app.pool.end().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Global safety net: the process must never die on an unhandled failure.
  process.on("unhandledRejection", (reason) => {
    app.logger.error("Unhandled rejection", { error: toAppError(reason).message });
  });
  process.on("uncaughtException", (error) => {
    app.logger.error("Uncaught exception", { error: toAppError(error).message });
  });

  await app.poller.start();
}

main().catch((error) => {
  const appError = toAppError(error);
  bootLogger.error("Fatal startup error", { code: appError.code, error: appError.message });
  process.exit(1);
});
