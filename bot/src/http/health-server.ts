import { createServer, type Server, type ServerResponse } from "node:http";
import type { Database } from "../infrastructure/db/pool.js";
import type { TelegramClient } from "../telegram/client.js";
import type { Logger } from "../core/logger.js";
import { toAppError } from "../core/errors.js";

export interface HealthDependencies {
  pool: Database;
  telegram: TelegramClient;
  logger: Logger;
  port: number;
  startedAt: number;
  version: string;
}

interface CheckResult {
  status: "up" | "down";
  latencyMs: number;
  detail?: string;
}

async function timed(fn: () => Promise<unknown>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { status: "up", latencyMs: Date.now() - start };
  } catch (error) {
    return { status: "down", latencyMs: Date.now() - start, detail: toAppError(error).message };
  }
}

/**
 * Minimal dependency-free HTTP server exposing operational endpoints.
 * Required by Render / Oracle Cloud / Docker health probes.
 *
 *   GET /health   -> liveness (process is running)
 *   GET /ready    -> readiness (database + Telegram reachable)
 *   GET /metrics  -> lightweight runtime counters
 */
export function createHealthServer(deps: HealthDependencies): {
  server: Server;
  listen: () => Promise<void>;
  close: () => Promise<void>;
} {
  const json = (res: ServerResponse, status: number, body: unknown) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
  };

  const server = createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];

    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "method_not_allowed" });
      return;
    }

    if (url === "/health" || url === "/") {
      json(res, 200, {
        status: "ok",
        service: "sci-telegram-platform",
        version: deps.version,
        uptimeSeconds: Math.round((Date.now() - deps.startedAt) / 1000),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (url === "/ready") {
      void (async () => {
        const [database, telegram] = await Promise.all([
          timed(() => deps.pool.query("SELECT 1")),
          timed(() => deps.telegram.getMe()),
        ]);
        const healthy = database.status === "up" && telegram.status === "up";
        json(res, healthy ? 200 : 503, {
          status: healthy ? "ready" : "degraded",
          checks: { database, telegram },
          timestamp: new Date().toISOString(),
        });
      })();
      return;
    }

    if (url === "/metrics") {
      const mem = process.memoryUsage();
      json(res, 200, {
        uptimeSeconds: Math.round(process.uptime()),
        memory: {
          rssMb: +(mem.rss / 1024 / 1024).toFixed(1),
          heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(1),
        },
        pool: {
          total: deps.pool.totalCount,
          idle: deps.pool.idleCount,
          waiting: deps.pool.waitingCount,
        },
        node: process.version,
      });
      return;
    }

    json(res, 404, { error: "not_found" });
  });

  return {
    server,
    listen: () =>
      new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(deps.port, "0.0.0.0", () => {
          deps.logger.info("Health server listening", { port: deps.port });
          resolve();
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
