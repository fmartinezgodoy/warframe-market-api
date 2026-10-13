import type { ServerResponse } from "node:http";
export function integer(value: string): number | null {
  if (!/^-?\d+$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}
export function send(response: ServerResponse, status: number, body: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}
export class GlobalRateLimiter {
  private timestamps: number[] = [];
  constructor(readonly limit: number, private readonly now = Date.now) {}
  take(): { limited: boolean; remaining: number; retryAfter: number } {
    const now = this.now();
    this.timestamps = this.timestamps.filter(time => now - time < 60_000);
    const limited = this.timestamps.length >= this.limit;
    if (!limited) this.timestamps.push(now);
    return { limited, remaining: Math.max(0, this.limit - this.timestamps.length),
      retryAfter: limited ? Math.max(1, Math.ceil(((this.timestamps[0] ?? now) + 60_000 - now) / 1000)) : 0 };
  }
}
