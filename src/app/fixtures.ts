import type { Item, Repository as CatalogRepository } from "../catalog/domain/catalog.js";
import type { Repository as OrdersRepository } from "../orders/domain/orders.js";
import { ItemNotFound } from "../orders/domain/orders.js";
// Synthetic examples only. No catalog, users, prices, or production data were copied.
const item: Item = { slug: "demo_mod", nameEn: "Demo Mod", nameEs: "Mod de ejemplo", tags: ["mod"], maxRank: 5 };
export const fixtureCatalog: CatalogRepository = { load: async () => [item] };
export const fixtureOrders: OrdersRepository = { get: async (slug, signal) => {
  signal.throwIfAborted();
  if (slug !== item.slug) throw new ItemNotFound();
  return { cached: false, orders: [{ type: "sell", platinum: 12, quantity: 1, rank: 5,
    user: { ingameName: "SyntheticTrader", reputation: 0, platform: "pc", crossplay: true, status: "ingame" } }] };
} };
