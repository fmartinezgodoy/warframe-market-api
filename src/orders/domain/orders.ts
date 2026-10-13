export interface OrderUser {
  ingameName: string;
  reputation: number;
  platform: string;
  crossplay: boolean;
  status?: string;
}
export interface Order {
  type: "sell" | "buy";
  platinum: number;
  quantity: number;
  rank?: number;
  user: OrderUser;
}
export interface Filters {
  type: "sell" | "buy" | null;
  rank: number | null;
  platform: string | null;
  crossplay: "true" | "false" | null;
}
export interface Result { orders: Order[]; cached: boolean }
export interface Context { platform: string; crossplay: boolean }
export function canonicalPlatform(value: string): string {
  return value === "xb1" ? "xbox" : value === "swi" ? "switch" : value;
}
export interface Repository { get(slug: string, signal: AbortSignal, context?: Context): Promise<Result> }
export interface Service { get(slug: string, filters: Filters, signal: AbortSignal): Promise<Result> }
export class ItemNotFound extends Error {}
export class UpstreamUnavailable extends Error {}
