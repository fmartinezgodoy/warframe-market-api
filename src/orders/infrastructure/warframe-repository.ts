import { setTimeout as delay } from "node:timers/promises";
import { ItemNotFound, UpstreamUnavailable } from "../domain/orders.js";
import type { Order, Repository, Result, Context } from "../domain/orders.js";
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseOrders(value: unknown): Order[] {
  if (!record(value) || !Array.isArray(value.data)) throw new UpstreamUnavailable("invalid_response");
  return value.data.map(raw => {
    if (!record(raw) || !record(raw.user) || !["sell", "buy"].includes(String(raw.type)) ||
      typeof raw.platinum !== "number" || !Number.isFinite(raw.platinum) || raw.platinum < 0 ||
      typeof raw.quantity !== "number" || !Number.isSafeInteger(raw.quantity) || raw.quantity < 0 ||
      (raw.rank !== undefined && (typeof raw.rank !== "number" || !Number.isSafeInteger(raw.rank) || raw.rank < 0)) ||
      typeof raw.user.ingameName !== "string" || typeof raw.user.reputation !== "number" ||
      !Number.isFinite(raw.user.reputation) || typeof raw.user.platform !== "string" ||
      typeof raw.user.crossplay !== "boolean" || (raw.user.status !== undefined && typeof raw.user.status !== "string")) {
      throw new UpstreamUnavailable("invalid_order");
    }
    return { type: raw.type as Order["type"], platinum: raw.platinum, quantity: raw.quantity,
      ...(raw.rank !== undefined ? { rank: raw.rank as number } : {}),
      user: { ingameName: raw.user.ingameName, reputation: raw.user.reputation,
        platform: raw.user.platform, crossplay: raw.user.crossplay,
        ...(raw.user.status !== undefined ? { status: raw.user.status as string } : {}) } };
  });
}
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new UpstreamUnavailable("empty_response");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) throw new UpstreamUnavailable("response_too_large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => undefined); }
}
export class WarframeOrdersRepository implements Repository {
  private tail: Promise<void> = Promise.resolve();
  private queued = 0;
  private nextStart = 0;
  constructor(private readonly intervalMs: number, private readonly retries: number,
    private readonly fetcher: typeof fetch = fetch, private readonly now = Date.now,
    private readonly baseUrl = "https://api.warframe.market/v2/orders/item/") {}
  async get(slug: string, signal: AbortSignal, context: Context = { platform: "pc", crossplay: false }): Promise<Result> {
    if (this.queued >= 32) throw new UpstreamUnavailable("queue_full");
    this.queued++;
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    try {
      await previous;
      for (let attempt = 0; ; attempt++) {
        signal.throwIfAborted();
        const wait = Math.max(0, this.nextStart - this.now());
        if (wait) await delay(wait, undefined, { signal });
        signal.throwIfAborted();
        this.nextStart = this.now() + this.intervalMs;
        let response: Response;
        try {
          response = await this.fetcher(`${this.baseUrl}${encodeURIComponent(slug)}`, {
            headers: { Language: "es", Accept: "application/json", Platform: context.platform, Crossplay: String(context.crossplay), "User-Agent": "WarframeMarketAPI/1.0.0 (+https://github.com/fmartinezgodoy/warframe-market-api)" }, signal, redirect: "error" });
        } catch {
          if (signal.aborted || attempt >= this.retries) throw new UpstreamUnavailable("request_failed");
          this.nextStart = Math.max(this.nextStart, this.now() + 500 * (attempt + 1));
          continue;
        }
        if (response.status === 404) {
          await response.body?.cancel();
          throw new ItemNotFound();
        }
        if (response.status === 429 || [502, 503, 504].includes(response.status)) {
          const retryAfter = response.headers.get("retry-after");
          const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : NaN;
          const date = retryAfter ? Date.parse(retryAfter) : NaN;
          const backoff = Number.isFinite(seconds) ? seconds * 1000
            : Number.isFinite(date) ? Math.max(0, date - this.now()) : 1000 * (attempt + 1);
          this.nextStart = Math.max(this.nextStart, this.now() + backoff);
          await response.body?.cancel();
          if (attempt < this.retries) continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new UpstreamUnavailable("upstream_status");
        }
        return { orders: parseOrders(await boundedJson(response)), cached: false };
      }
    } catch (error) {
      if (error instanceof ItemNotFound) throw error;
      throw new UpstreamUnavailable("upstream_unavailable");
    } finally { this.queued--; release(); }
  }
}
