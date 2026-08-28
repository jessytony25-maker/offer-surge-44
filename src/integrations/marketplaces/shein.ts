import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  notConfigured,
} from "./types";

/**
 * SHEIN — programa de afiliados operado por redes parceiras (ex.: Awin/Rakuten).
 * O acesso a catálogo/feed depende da rede aprovada para a conta do usuário.
 */
export const sheinAdapter: MarketplaceAdapter = {
  slug: "shein",
  name: "SHEIN",
  program: "SHEIN Affiliate (via rede parceira)",
  docsUrl: "https://br.shein.com/Affiliate-Program-a-1229.html",
  credentialFields: [
    { key: "affiliate_id", label: "ID de publisher na rede", required: true },
    { key: "api_key", label: "Chave da rede parceira", secret: true },
    { key: "tracking_id", label: "Tracking / campanha" },
  ],
  capabilities: {
    searchProducts: false,
    listOffers: true,
    productDetails: false,
    price: true,
    image: true,
    availability: false,
    affiliateInfo: true,
    linkConversion: true,
    sync: true,
  },
  matchesUrl: (url) => /shein\.[a-z.]+/i.test(url),
  async searchProducts(): Promise<AdapterResult<NormalizedProduct[]>> {
    return notConfigured("SHEIN");
  },
  async listOffers(): Promise<AdapterResult<NormalizedProduct[]>> {
    return notConfigured("SHEIN");
  },
  async getProduct(): Promise<AdapterResult<NormalizedProduct>> {
    return notConfigured("SHEIN");
  },
  async buildAffiliateLink(): Promise<AdapterResult<string>> {
    return notConfigured("SHEIN");
  },
  async sync(): Promise<AdapterResult<{ imported: number; at: string }>> {
    return notConfigured("SHEIN");
  },
};
