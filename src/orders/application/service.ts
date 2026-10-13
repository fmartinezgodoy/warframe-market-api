import { canonicalPlatform } from "../domain/orders.js";
import type { Repository, Service, Filters } from "../domain/orders.js";
export class OrdersService implements Service {
  constructor(private readonly repository: Repository) {}
  async get(slug: string, filters: Filters, signal: AbortSignal) {
    const result = await this.repository.get(slug, signal, { platform: canonicalPlatform(filters.platform ?? "pc"), crossplay: filters.crossplay === "true" });
    const orders = result.orders.filter(order =>
      (filters.type === null || order.type === filters.type) &&
      (filters.rank === null || order.rank === filters.rank) &&
      (filters.platform === null || canonicalPlatform(order.user.platform) === canonicalPlatform(filters.platform)) &&
      (filters.crossplay === null || order.user.crossplay === (filters.crossplay === "true"))
    ).sort((a, b) => a.type !== b.type ? (a.type === "sell" ? -1 : 1)
      : a.type === "sell" ? a.platinum - b.platinum : b.platinum - a.platinum);
    return { orders, cached: result.cached };
  }
}
