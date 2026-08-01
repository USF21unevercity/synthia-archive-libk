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

  // HTTP first: in webhook mode the endpoint must be live before Telegram is pointed at it.
  await app.health.listen();

  if (app.config.mode === "webhook" && app.webhookUrl) {
    await app.telegram.setWebhook(app.webhookUrl, app.config.webhookSecret);
    const info = await app.telegram.getWebhookInfo();
    app.logger.info("Telegram webhook registered", {
      url: info.url,
      pending: info.pending_update_count,
    });
  } else {
    await app.telegram.deleteWebhook(false);
    app.logger.info("Telegram polling mode verified; webhook cleared without dropping updates");
  }

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

  if (app.config.mode === "webhook") {
    // Self-heal: re-register the webhook if Telegram ever drops it.
    const interval = setInterval(() => {
      void (async () => {
        try {
          const info = await app.telegram.getWebhookInfo();
          if (info.url !== app.webhookUrl) {
            app.logger.warn("Webhook missing or changed, re-registering", { current: info.url });
            await app.telegram.setWebhook(app.webhookUrl!, app.config.webhookSecret);
          }
        } catch (error) {
          runtimeLogger.warn("Webhook health check failed", { error: toAppError(error).message });
        }
      })();
    }, 5 * 60 * 1000);
    interval.unref();
    app.logger.info("Bot running in webhook mode", { url: app.webhookUrl });
    return;
  }

  await app.poller.start();
}

main().catch((error) => {
  const appError = toAppError(error);
  bootLogger.error("Fatal startup error", { code: appError.code, error: appError.message });
  process.exit(1);
});
