import { Redis } from "ioredis";
import type { Config } from "../platform/config.js";
import { CatalogService } from "../catalog/application/service.js";
import { RedisCatalogRepository } from "../catalog/infrastructure/redis-repository.js";
import { FuseIndex } from "../catalog/infrastructure/fuse-index.js";
import { OrdersService } from "../orders/application/service.js";
import { CachedOrdersRepository } from "../orders/infrastructure/cached-repository.js";
import { WarframeOrdersRepository } from "../orders/infrastructure/warframe-repository.js";
import { createServer } from "./application.js";
import type { Logger } from "./application.js";
import { fixtureCatalog, fixtureOrders } from "./fixtures.js";
export async function start(config: Config, log: Logger = event => console.log(JSON.stringify(event))) {
  const redis = config.source === "redis" ? new Redis(config.redisUrl, {
    lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1,
    connectTimeout: config.redisTimeoutMs, commandTimeout: config.redisTimeoutMs,
    retryStrategy: () => null,
  }) : undefined;
  redis?.on("error", () => log({ event: "catalog_connection_failed" }));
  const catalog = new CatalogService(redis ? new RedisCatalogRepository(redis) : fixtureCatalog,
    new FuseIndex(), config.maxAgeMs);
  const source = redis ? new WarframeOrdersRepository(config.intervalMs, config.retries) : fixtureOrders;
  const orders = new OrdersService(new CachedOrdersRepository(source, config.cacheTtlMs,
    config.cacheCapacity, config.upstreamTimeoutMs));
  const { server, drain } = createServer(config, catalog, orders, log);
  let stopping = false;
  let timer: NodeJS.Timeout | undefined;
  async function refresh() {
    try {
      if (redis && redis.status !== "ready") { redis.disconnect(); await redis.connect(); }
      const count = await catalog.refresh();
      log({ event: "catalog_refreshed", count });
    } catch { log({ event: "catalog_refresh_failed" }); }
    if (!stopping) timer = setTimeout(() => void refresh(), catalog.ready() ? config.refreshMs : 5000);
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => { server.off("error", reject); resolve(); });
  }).catch(error => { redis?.disconnect(); throw error; });
  void refresh();
  log({ event: "server_started", source: config.source, port: config.port });
  return { server, async stop() {
    if (stopping) return;
    stopping = true;
    drain();
    clearTimeout(timer);
    const forced = setTimeout(() => { server.closeAllConnections(); redis?.disconnect(); }, config.shutdownMs);
    await new Promise<void>(resolve => server.close(() => resolve()));
    clearTimeout(forced);
    redis?.disconnect();
  } };
}
