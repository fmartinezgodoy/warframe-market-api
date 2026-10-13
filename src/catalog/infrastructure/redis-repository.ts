import type { Redis } from "ioredis";
import type { Item, Repository } from "../domain/catalog.js";
export class RedisCatalogRepository implements Repository {
  constructor(private readonly redis: Redis) {}
  async load(): Promise<Item[]> {
    const slugs = await this.redis.hvals("wf:id_map");
    const items: Item[] = [];
    for (let offset = 0; offset < slugs.length; offset += 500) {
      const pipeline = this.redis.pipeline();
      for (const slug of slugs.slice(offset, offset + 500)) pipeline.hgetall(`wf:item:${slug}`);
      const results = await pipeline.exec();
      if (!results) throw new Error("catalog_read_failed");
      for (const [error, value] of results) {
        if (error) throw new Error("catalog_read_failed");
        const h = value as Record<string, string>;
        if (!h.slug || !h.nameEn) continue;
        let tags: string[] = [];
        try {
          const parsed: unknown = JSON.parse(h.tags ?? "[]");
          if (Array.isArray(parsed) && parsed.every(tag => typeof tag === "string")) tags = parsed;
        } catch { /* A malformed optional tag field does not hide an otherwise valid item. */ }
        const parsedRank = Number(h.maxRank ?? "0");
        const maxRank = Number.isSafeInteger(parsedRank) && parsedRank >= 0 ? parsedRank : 0;
        items.push({ slug: h.slug, nameEn: h.nameEn, nameEs: h.nameEs || h.nameEn, tags, maxRank });
      }
    }
    return items;
  }
}
