import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  notConfigured,
} from "./types";

/**
 * Shopee — Programa de Afiliados Shopee (Shopee Affiliate Open API).
 * As credenciais reais devem ser cadastradas em Links de Afiliado; enquanto
 * isso, todas as operações respondem "aguardando configuração".
 */
export const shopeeAdapter: MarketplaceAdapter = {
  slug: "shopee",
  name: "Shopee",
  program: "Shopee Affiliate Open API",
  docsUrl: "https://affiliate.shopee.com.br/",
  credentialFields: [
    { key: "affiliate_id", label: "ID de afiliado", required: true },
    { key: "api_key", label: "App ID", required: true },
    { key: "api_secret", label: "App Secret", secret: true, required: true },
    { key: "sub_id", label: "Sub ID (rastreamento)" },
  ],
  capabilities: {
    searchProducts: true,
    listOffers: true,
    productDetails: true,
    price: true,
    image: true,
    availability: true,
    affiliateInfo: true,
    linkConversion: true,
    sync: true,
  },
  matchesUrl: (url) => /shopee\.[a-z.]+/i.test(url),
  async searchProducts(): Promise<AdapterResult<NormalizedProduct[]>> {
    return notConfigured("Shopee");
  },
  async listOffers(): Promise<AdapterResult<NormalizedProduct[]>> {
    return notConfigured("Shopee");
  },
  async getProduct(): Promise<AdapterResult<NormalizedProduct>> {
    return notConfigured("Shopee");
  },
  async buildAffiliateLink(): Promise<AdapterResult<string>> {
    return notConfigured("Shopee");
  },
  async sync(): Promise<AdapterResult<{ imported: number; at: string }>> {
    return notConfigured("Shopee");
  },
};
