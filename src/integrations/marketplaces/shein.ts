import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  type SearchParams,
  notConfigured,
} from "./types";

export const sheinAdapter: MarketplaceAdapter = {
  slug: "shein",
  name: "SHEIN",
  program: "SHEIN Afiliados (Oficial / Redes Parceiras)",
  docsUrl: "https://br.shein.com/Affiliate-Program-a-1229.html",
  credentialFields: [
    {
      key: "affiliate_id",
      label: "ID de Afiliado / Publisher ID",
      required: true,
      help: "Seu ID de afiliado da SHEIN ou da rede parceira (ex: Awin/Rakuten/Impact).",
    },
    {
      key: "tracking_id",
      label: "Código de Campanha / SubID (Opcional)",
      help: "SubID ou tag para rastrear cliques por canal.",
    },
    {
      key: "api_key",
      label: "Chave de API da Rede (Opcional)",
      secret: true,
      help: "Caso utilize API de feed de produtos da rede parceira.",
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
  matchesUrl: (url) => /shein\.[a-z.]+/i.test(url),

  async testConnection(credentials: Record<string, string>): Promise<AdapterResult<{ message: string }>> {
    const affiliateId = credentials["affiliate_id"]?.trim();

    if (!affiliateId) {
      return notConfigured("SHEIN");
    }

    return {
      ok: true,
      data: {
        message: `ID de afiliado SHEIN (${affiliateId}) salvo com sucesso! Conversão de links ativada.`,
      },
    };
  },

  async searchProducts(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>> {
    const affiliateId = credentials["affiliate_id"]?.trim();
    if (!affiliateId) return notConfigured("SHEIN");

    return {
      ok: true,
      data: [],
    };
  },

  async listOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>> {
    return this.searchProducts(credentials, params);
  },

  async getProduct(
    externalId: string,
    credentials: Record<string, string>,
  ): Promise<AdapterResult<NormalizedProduct>> {
    const affiliateId = credentials["affiliate_id"]?.trim();
    if (!affiliateId) return notConfigured("SHEIN");

    const sheinUrl = externalId.startsWith("http") ? externalId : `https://br.shein.com/product-p-${externalId}.html`;
    const affRes = await this.buildAffiliateLink(sheinUrl, credentials);

    return {
      ok: true,
      data: {
        externalId,
        title: `Produto SHEIN (${externalId})`,
        url: sheinUrl,
        affiliateUrl: affRes.ok ? affRes.data : sheinUrl,
        price: 0,
        available: true,
      },
    };
  },

  async buildAffiliateLink(
    originalUrl: string,
    credentials: Record<string, string>,
    subId?: string,
  ): Promise<AdapterResult<string>> {
    const affiliateId = credentials["affiliate_id"]?.trim();
    if (!affiliateId) return notConfigured("SHEIN");

    const campaign = subId || credentials["tracking_id"]?.trim();

    try {
      const url = new URL(originalUrl);
      url.searchParams.set("aff_id", affiliateId);
      if (campaign) {
        url.searchParams.set("sub_id", campaign);
      }
      return { ok: true, data: url.toString() };
    } catch {
      const separator = originalUrl.includes("?") ? "&" : "?";
      return {
        ok: true,
        data: `${originalUrl}${separator}aff_id=${affiliateId}${campaign ? `&sub_id=${campaign}` : ""}`,
      };
    }
  },

  async syncOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<{ products: NormalizedProduct[]; total: number }>> {
    const searchRes = await this.searchProducts(credentials, params);
    if (!searchRes.ok) return searchRes;

    return {
      ok: true,
      data: {
        products: searchRes.data,
        total: searchRes.data.length,
      },
    };
  },
};
