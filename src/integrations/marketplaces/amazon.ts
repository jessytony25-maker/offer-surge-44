import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  notConfigured,
} from "./types";

/**
 * Amazon — Product Advertising API 5.0 (Amazon Associates).
 * Exige conta aprovada no programa Associados e vendas qualificadas.
 */
export const amazonAdapter: MarketplaceAdapter = {
  slug: "amazon",
  name: "Amazon",
  program: "Amazon Associates — Product Advertising API 5.0",
  docsUrl: "https://associados.amazon.com.br/",
  credentialFields: [
    {
      key: "tracking_id",
      label: "Tag/ID de Rastreamento",
      required: true,
      help: "É a mesma tag que aparece ao gerar um link no painel Amazon Associados / SiteStripe (normalmente termina com -20).",
    },
    {
      key: "api_key",
      label: "ID da Credencial (API de Criadores)",
      help: "Opcional — preencha quando tiver acesso à API. A Amazon libera após 10 vendas aprovadas em 30 dias.",
    },
    {
      key: "api_secret",
      label: "Segredo (API de Criadores)",
      secret: true,
      help: "Opcional — preencha quando tiver acesso à API.",
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
  matchesUrl: (url) => /amazon\.[a-z.]+|amzn\.to/i.test(url),
  async searchProducts(): Promise<AdapterResult<NormalizedProduct[]>> {
    return notConfigured("Amazon");
  },
  async listOffers(): Promise<AdapterResult<NormalizedProduct[]>> {
    return notConfigured("Amazon");
  },
  async getProduct(): Promise<AdapterResult<NormalizedProduct>> {
    return notConfigured("Amazon");
  },
  async buildAffiliateLink(): Promise<AdapterResult<string>> {
    return notConfigured("Amazon");
  },
  async sync(): Promise<AdapterResult<{ imported: number; at: string }>> {
    return notConfigured("Amazon");
  },
};
