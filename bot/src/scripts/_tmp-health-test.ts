import { createPool } from "../infrastructure/db/pool.js";
import { createLogger } from "../core/logger.js";
import { TelegramClient } from "../telegram/client.js";
import { createHealthServer } from "../http/health-server.js";
const logger = createLogger("info", "test");
const pool = createPool(process.env.DATABASE_URL!, logger);
const h = createHealthServer({ pool, telegram: new TelegramClient("123:dummy", logger), logger, port: 8099, startedAt: Date.now(), version: "0.1.0" });
await h.listen();
for (const p of ["/health", "/ready", "/metrics"]) {
  const r = await fetch(`http://127.0.0.1:8099${p}`);
  console.log(p, r.status, (await r.text()).slice(0, 220));
}
await h.close(); await pool.end();
