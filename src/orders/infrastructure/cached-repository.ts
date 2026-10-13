import type { Repository, Result, Context } from "../domain/orders.js";
export class CachedOrdersRepository implements Repository {
  private readonly entries = new Map<string, { result: Result; expires: number }>();
  private readonly pending = new Map<string, Promise<Result>>();
  constructor(private readonly source: Repository, private readonly ttlMs: number,
    private readonly capacity: number, private readonly timeoutMs: number, private readonly now = Date.now) {}
  async get(slug: string, signal: AbortSignal, context: Context = { platform: "pc", crossplay: false }): Promise<Result> {
    const key = `${slug}:${context.platform}:${context.crossplay}`;
    signal.throwIfAborted();
    const hit = this.entries.get(key);
    if (hit && hit.expires > this.now()) return { orders: hit.result.orders, cached: true };
    let task = this.pending.get(key);
    if (!task) {
      task = this.source.get(slug, AbortSignal.timeout(this.timeoutMs), context).then(result => {
        this.entries.delete(key);
        for (const [key, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(key);
        while (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
        this.entries.set(key, { result, expires: this.now() + this.ttlMs });
        return result;
      }).finally(() => this.pending.delete(key));
      this.pending.set(key, task);
    }
    // Each caller can disconnect independently without cancelling another caller's shared fetch.
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      task!.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }
}
