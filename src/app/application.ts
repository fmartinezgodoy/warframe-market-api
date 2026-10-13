import http from "node:http";
import { randomUUID } from "node:crypto";
import type { Config } from "../platform/config.js";
import { send, GlobalRateLimiter } from "../platform/http.js";
import type { Service as CatalogService } from "../catalog/domain/catalog.js";
import type { Service as OrdersService } from "../orders/domain/orders.js";
import { CatalogController } from "../catalog/infrastructure/controller.js";
import { OrdersController } from "../orders/infrastructure/controller.js";
export type Logger = (event: Record<string, unknown>) => void;
export function createServer(config: Config, catalog: CatalogService, orders: OrdersService,
  log: Logger = event => console.log(JSON.stringify(event))) {
  const search = new CatalogController(catalog);
  const orderController = new OrdersController(orders);
  const limiter = new GlobalRateLimiter(config.rateLimit);
  let draining = false;
  const server = http.createServer(async (request, response) => {
    const started = Date.now();
    const requestId = randomUUID();
    response.setHeader("X-Request-ID", requestId);
    response.setHeader("Access-Control-Allow-Origin", config.cors);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Expose-Headers", "X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After");
    response.setHeader("X-Content-Type-Options", "nosniff");
    let route = "unknown";
    response.on("finish", () => log({ event: "request", requestId, route, method: request.method,
      status: response.statusCode, durationMs: Date.now() - started }));
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const match = url.pathname.match(/^\/orders\/([a-z0-9_-]{1,200})$/);
      route = ["/health", "/livez", "/readyz", "/search"].includes(url.pathname)
        ? url.pathname : match ? "/orders/{slug}" : "unknown";
      if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
      if (request.method !== "GET") return send(response, 405, { error: "method not allowed" });
      if (url.pathname === "/livez") return send(response, 200, { ok: true });
      if (url.pathname === "/readyz") {
        const ready = !draining && catalog.ready();
        return send(response, ready ? 200 : 503, { ok: ready, indexReady: catalog.ready() });
      }
      const rate = limiter.take();
      response.setHeader("X-RateLimit-Limit", config.rateLimit);
      response.setHeader("X-RateLimit-Remaining", rate.remaining);
      if (rate.limited) {
        response.setHeader("Retry-After", rate.retryAfter);
        return send(response, 429, { error: `rate limit: ${config.rateLimit} req/min global` });
      }
      if (url.pathname === "/health") return send(response, 200, { ok: true, indexReady: catalog.ready() });
      if (draining) return send(response, 503, { error: "service shutting down" });
      if (url.pathname === "/search") return search.search(url, response);
      if (match) {
        const disconnected = new AbortController();
        const abort = () => disconnected.abort();
        response.on("close", abort);
        try {
          const signal = AbortSignal.any([disconnected.signal, AbortSignal.timeout(config.requestTimeoutMs)]);
          return await orderController.get(match[1]!, url, response, signal);
        } finally { response.off("close", abort); }
      }
      send(response, 404, { error: "not found", routes: ["GET /health", "GET /search?q=", "GET /orders/{slug}"] });
    } catch { send(response, 500, { error: "internal error" }); }
  });
  server.requestTimeout = config.requestTimeoutMs;
  server.headersTimeout = config.requestTimeoutMs;
  server.keepAliveTimeout = 5000;
  return { server, drain: () => { draining = true; } };
}
