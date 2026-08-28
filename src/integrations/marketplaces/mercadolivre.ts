import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  notConfigured,
} from "./types";

/**
 * Mercado Livre — Programa de Afiliados / Mercado Livre Developers API.
 */
export const mercadoLivreAdapter: MarketplaceAdapter = {
  slug: "mercadolivre",
  name: "Mercado Livre",
  program: "Mercado Livre Developers + Programa de Afiliados",
  docsUrl: "https://developers.mercadolivre.com.br/",
  credentialFields: [
    { key: "affiliate_id", label: "ID de afiliado", required: true },
    { key: "api_key", label: "Client ID", required: true },
    { key: "api_secret", label: "Client Secret", secret: true, required: true },
    { key: "tracking_id", label: "Tracking ID" },
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
  matchesUrl: (url) => /(mercadolivre|mercadolibre)\.[a-z.]+/i.test(url),
  async searchProducts(): Promise<AdapterResult<NormalizedProduct[]>> {
    return notConfigured("Mercado Livre");
  },
  async listOffers(): Promise<AdapterResult<NormalizedProduct[]>> {
    return notConfigured("Mercado Livre");
  },
  async getProduct(): Promise<AdapterResult<NormalizedProduct>> {
    return notConfigured("Mercado Livre");
  },
  async buildAffiliateLink(): Promise<AdapterResult<string>> {
    return notConfigured("Mercado Livre");
  },
  async sync(): Promise<AdapterResult<{ imported: number; at: string }>> {
    return notConfigured("Mercado Livre");
  },
};
