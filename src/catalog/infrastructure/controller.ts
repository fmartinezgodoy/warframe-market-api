import type { Service } from "../domain/catalog.js";
import { send, integer } from "../../platform/http.js";
import type { ServerResponse } from "node:http";
export class CatalogController {
  constructor(private readonly service: Service) {}
  search(url: URL, response: ServerResponse): void {
    const query = url.searchParams.get("q")?.trim();
    const rank = url.searchParams.get("rank") ?? "maxed";
    if (rank !== "0" && rank !== "maxed") return send(response, 400, { error: "rank debe ser 0 o maxed" });
    if (!query) return send(response, 400, { error: "falta ?q=" });
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit === null ? 10 : integer(rawLimit);
    if (limit === null) return send(response, 400, { error: "limit debe ser un entero" });
    if (query.length > 200) return send(response, 400, { error: "q demasiado largo" });
    if (!this.service.ready()) return send(response, 503, { error: "índice cargando" });
    const results = this.service.search(query, Math.min(Math.max(limit, 1), 50), rank);
    send(response, 200, { query, rank, count: results.length, results });
  }
}
