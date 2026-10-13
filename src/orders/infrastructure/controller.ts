import type { ServerResponse } from "node:http";
import type { Service, Filters } from "../domain/orders.js";
import { ItemNotFound } from "../domain/orders.js";
import { integer, send } from "../../platform/http.js";
export class OrdersController {
  constructor(private readonly service: Service) {}
  async get(slug: string, url: URL, response: ServerResponse, signal: AbortSignal): Promise<void> {
    const type = url.searchParams.get("type");
    if (type !== null && type !== "sell" && type !== "buy") return send(response, 400, { error: "type debe ser sell o buy" });
    const rankRaw = url.searchParams.get("rank");
    const rank = rankRaw === null ? null : integer(rankRaw);
    if (rankRaw !== null && (rank === null || rank < 0)) return send(response, 400, { error: "rank debe ser un entero >= 0" });
    const platform = url.searchParams.get("platform");
    if (platform !== null && !["pc", "ps4", "xb1", "swi", "xbox", "switch", "mobile"].includes(platform)) return send(response, 400, { error: "platform debe ser pc, ps4, xb1 o swi" });
    const crossplay = url.searchParams.get("crossplay");
    if (crossplay !== null && crossplay !== "true" && crossplay !== "false") return send(response, 400, { error: "crossplay debe ser true o false" });
    const filters: Filters = { type, rank, platform, crossplay };
    try {
      const data = await this.service.get(slug, filters, signal);
      send(response, 200, { slug, count: data.orders.length, cached: data.cached, filters, orders: data.orders });
    } catch (error) {
      if (error instanceof ItemNotFound) return send(response, 404, { error: `item no encontrado: ${slug}` });
      send(response, 502, { error: "upstream no disponible" });
    }
  }
}
