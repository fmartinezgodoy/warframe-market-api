export interface Item {
  slug: string;
  nameEn: string;
  nameEs: string;
  tags: string[];
  maxRank: number;
}
export interface Repository { load(): Promise<Item[]> }
export interface SearchIndex {
  replace(items: Item[]): void;
  search(query: string, limit: number): Item[];
}
export interface Service {
  refresh(): Promise<number>;
  ready(): boolean;
  search(query: string, limit: number, rank: "0" | "maxed"): (Item & { rank: number | null })[];
}
