import { isIP } from "node:net";
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  function number(name: string, fallback: number, minimum: number, maximum: number): number {
    const raw = env[name] ?? String(fallback);
    if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${name}`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${name}`);
    return value;
  }
  const host = env.HTTP_HOST ?? "127.0.0.1";
  if (!isIP(host)) throw new Error("Invalid HTTP_HOST");
  const source = env.DATA_SOURCE ?? "redis";
  if (source !== "redis" && source !== "fixtures") throw new Error("Invalid DATA_SOURCE");
  const redisUrl = env.REDIS_URL ?? "redis://127.0.0.1:6379/0";
  let parsed: URL;
  try { parsed = new URL(redisUrl); } catch { throw new Error("Invalid REDIS_URL"); }
  if (!["redis:", "rediss:"].includes(parsed.protocol) || parsed.hash || parsed.search ||
    !/^\/\d*$/.test(parsed.pathname)) throw new Error("Invalid REDIS_URL");
  const refreshMs = number("CATALOG_REFRESH_MS", 900_000, 1000, 86_400_000);
  const maxAgeMs = number("CATALOG_MAX_AGE_MS", 1_800_000, 1000, 86_400_000);
  if (maxAgeMs <= refreshMs) throw new Error("CATALOG_MAX_AGE_MS must exceed CATALOG_REFRESH_MS");
  const upstreamTimeoutMs = number("UPSTREAM_TIMEOUT_MS", 8000, 100, 30_000);
  const requestTimeoutMs = number("REQUEST_TIMEOUT_MS", 10_000, 100, 60_000);
  if (requestTimeoutMs <= upstreamTimeoutMs) throw new Error("REQUEST_TIMEOUT_MS must exceed UPSTREAM_TIMEOUT_MS");
  const cors = env.CORS_ORIGIN ?? "*";
  if (cors !== "*") {
    let origin: URL;
    try { origin = new URL(cors); } catch { throw new Error("Invalid CORS_ORIGIN"); }
    if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== cors) throw new Error("Invalid CORS_ORIGIN");
  }
  return { host, port: number("HTTP_PORT", 6002, 1024, 65535), source, redisUrl, refreshMs, maxAgeMs,
    redisTimeoutMs: number("REDIS_TIMEOUT_MS", 1500, 100, 10_000), upstreamTimeoutMs, requestTimeoutMs,
    intervalMs: number("UPSTREAM_INTERVAL_MS", 340, 340, 60_000), retries: number("UPSTREAM_RETRIES", 1, 0, 2),
    cacheTtlMs: number("ORDERS_CACHE_TTL_MS", 60_000, 100, 300_000),
    cacheCapacity: number("ORDERS_CACHE_CAPACITY", 200, 1, 10_000),
    rateLimit: number("HTTP_RATE_LIMIT", 100, 1, 10_000), cors,
    shutdownMs: number("SHUTDOWN_TIMEOUT_MS", 5000, 100, 30_000) };
}
export type Config = ReturnType<typeof loadConfig>;
