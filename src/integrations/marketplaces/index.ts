import { amazonAdapter } from "./amazon";
import { mercadoLivreAdapter } from "./mercadolivre";
import { sheinAdapter } from "./shein";
import { shopeeAdapter } from "./shopee";
import type { MarketplaceAdapter, MarketplaceSlug } from "./types";

/** Registro modular — adicionar um marketplace novo é registrar um adaptador aqui. */
export const MARKETPLACE_ADAPTERS: Record<MarketplaceSlug, MarketplaceAdapter> = {
  shopee: shopeeAdapter,
  mercadolivre: mercadoLivreAdapter,
  amazon: amazonAdapter,
  shein: sheinAdapter,
};

export const MARKETPLACE_LIST = Object.values(MARKETPLACE_ADAPTERS);

export function detectMarketplace(url: string): MarketplaceAdapter | null {
  return MARKETPLACE_LIST.find((adapter) => adapter.matchesUrl(url)) ?? null;
}

export function marketplaceName(slug?: string | null) {
  if (!slug) return "—";
  return MARKETPLACE_ADAPTERS[slug as MarketplaceSlug]?.name ?? slug;
}

export * from "./types";
