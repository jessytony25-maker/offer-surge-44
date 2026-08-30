/**
 * Camada de integração com marketplaces.
 *
 * Interface padronizada que toda integração de marketplace implementa.
 * Realiza autenticação, validação de credenciais, busca de ofertas reais,
 * normalização e conversão de links de afiliados.
 */

export type MarketplaceSlug = "shopee" | "mercadolivre" | "amazon" | "shein";

export type IntegrationState = "not_configured" | "pending" | "connected" | "error";

export interface CredentialField {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
}

export interface NormalizedProduct {
  externalId: string;
  title: string;
  imageUrl?: string;
  url?: string;
  affiliateUrl?: string;
  sku?: string;
  category?: string;
  price: number;
  previousPrice?: number | null;
  discountPct?: number;
  rating?: number | null;
  ratingCount?: number | null;
  salesCount?: number | null;
  coupon?: string | null;
  commission?: number | null;
  commissionPct?: number | null;
  freeShipping?: boolean;
  available?: boolean;
}

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; state: IntegrationState; message: string };

export interface SearchParams {
  keyword?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export interface MarketplaceAdapter {
  slug: MarketplaceSlug;
  name: string;
  program: string;
  docsUrl?: string;
  credentialFields: CredentialField[];
  capabilities: {
    searchProducts: boolean;
    listOffers: boolean;
    productDetails: boolean;
    price: boolean;
    image: boolean;
    availability: boolean;
    affiliateInfo: boolean;
    linkConversion: boolean;
    sync: boolean;
  };
  testConnection(credentials: Record<string, string>): Promise<AdapterResult<{ message: string }>>;
  searchProducts(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>>;
  listOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>>;
  getProduct(
    externalId: string,
    credentials: Record<string, string>,
  ): Promise<AdapterResult<NormalizedProduct>>;
  buildAffiliateLink(
    originalUrl: string,
    credentials: Record<string, string>,
    subId?: string,
  ): Promise<AdapterResult<string>>;
  syncOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<{ products: NormalizedProduct[]; total: number }>>;
  matchesUrl(url: string): boolean;
}

export const NOT_CONFIGURED_MESSAGE = "Integração aguardando configuração";

export function notConfigured<T>(name: string): AdapterResult<T> {
  return {
    ok: false,
    state: "not_configured",
    message: `${NOT_CONFIGURED_MESSAGE} — ${name}`,
  };
}
