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
    {
      key: "affiliate_id",
      label: "Etiqueta (matt_word)",
      required: true,
      help: "Preenchida automaticamente a partir do link de afiliado para evitar erros de digitação.",
    },
    {
      key: "tracking_id",
      label: "ID da Ferramenta (matt_tool)",
      required: true,
      help: "Também extraído do link de afiliado que você gerou no Mercado Livre.",
    },
    { key: "api_key", label: "Client ID (opcional)" },
    { key: "api_secret", label: "Client Secret (opcional)", secret: true },
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
