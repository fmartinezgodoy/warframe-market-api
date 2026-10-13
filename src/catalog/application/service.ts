import type { Repository, SearchIndex, Service } from "../domain/catalog.js";
export class CatalogService implements Service {
  private refreshedAt: number | undefined;
  constructor(private readonly repository: Repository, private readonly index: SearchIndex,
    private readonly maxAgeMs: number, private readonly now = Date.now) {}
  async refresh(): Promise<number> {
    const items = await this.repository.load();
    if (!items.length) throw new Error("catalog_empty");
    this.index.replace(items);
    this.refreshedAt = this.now();
    return items.length;
  }
  ready(): boolean {
    return this.refreshedAt !== undefined && this.now() - this.refreshedAt < this.maxAgeMs;
  }
  search(query: string, limit: number, rank: "0" | "maxed") {
    return this.index.search(query, limit).map(item => ({ ...item,
      rank: item.tags.includes("mod") || item.tags.includes("arcane")
        ? (rank === "maxed" ? item.maxRank : 0) : null }));
  }
}
