/**
 * Camada de integração com marketplaces.
 *
 * Interface padronizada que TODA integração deve implementar. Nenhum endpoint é
 * inventado aqui: enquanto as credenciais oficiais da API não estiverem
 * configuradas, o adaptador responde `not_configured` e a interface mostra
 * "Integração aguardando configuração".
 */

export type MarketplaceSlug = "shopee" | "mercadolivre" | "amazon" | "shein";

export type IntegrationState = "not_configured" | "pending" | "connected" | "error";

export interface CredentialField {
  key: string;
  label: string;
  /** Campos secretos nunca são exibidos novamente após serem salvos. */
  secret?: boolean;
  required?: boolean;
  help?: string;
}

export interface NormalizedProduct {
  externalId: string;
  title: string;
  imageUrl?: string;
  url?: string;
  sku?: string;
  category?: string;
  price?: number;
  previousPrice?: number;
  discountPct?: number;
  rating?: number;
  ratingCount?: number;
  salesCount?: number;
  coupon?: string;
  commissionPct?: number;
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
  /** Programa oficial de afiliados / API usada quando configurada. */
  program: string;
  /** Documentação oficial para o usuário obter as credenciais. */
  docsUrl?: string;
  credentialFields: CredentialField[];
  /** Recursos que a API oficial permite. */
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
  searchProducts(params: SearchParams): Promise<AdapterResult<NormalizedProduct[]>>;
  listOffers(params: SearchParams): Promise<AdapterResult<NormalizedProduct[]>>;
  getProduct(externalId: string): Promise<AdapterResult<NormalizedProduct>>;
  buildAffiliateLink(
    originalUrl: string,
    credentials: Record<string, string>,
  ): Promise<AdapterResult<string>>;
  sync(): Promise<AdapterResult<{ imported: number; at: string }>>;
  /** Reconhece se uma URL pertence a este marketplace. */
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
