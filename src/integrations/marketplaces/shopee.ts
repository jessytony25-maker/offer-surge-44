import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  notConfigured,
} from "./types";

/**
 * Shopee — Shopee Affiliate Open API (GraphQL).
 * A conexão real é feita apenas com App ID + Secret (senha da API); as chamadas
 * autenticadas vivem em `src/lib/shopee.server.ts`.
 */
export const shopeeAdapter: MarketplaceAdapter = {
  slug: "shopee",
  name: "Shopee",
  program: "Shopee Affiliate Open API",
  docsUrl: "https://affiliate.shopee.com.br/open_api",
  credentialFields: [
    {
      key: "api_key",
      label: "App ID",
      required: true,
      help: "Painel de Afiliados Shopee → Open API → App ID.",
    },
    {
      key: "api_secret",
      label: "Senha da API (Secret)",
      secret: true,
      required: true,
      help: "Mesma tela do App ID. Fica guardada apenas no servidor.",
    },
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
