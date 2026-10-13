import Fuse from "fuse.js";
import type { Item, SearchIndex } from "../domain/catalog.js";
export class FuseIndex implements SearchIndex {
  private fuse = new Fuse<Item>([], {
    keys: [{ name: "nameEn", weight: 0.4 }, { name: "nameEs", weight: 0.4 },
      { name: "slug", weight: 0.1 }, { name: "tags", weight: 0.1 }],
    threshold: 0.4, includeScore: true, ignoreLocation: true,
  });
  replace(items: Item[]): void { this.fuse.setCollection(items); }
  search(query: string, limit: number): Item[] {
    return this.fuse.search(query, { limit }).map(result => result.item);
  }
}
