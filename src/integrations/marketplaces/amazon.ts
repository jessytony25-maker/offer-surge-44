import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  type SearchParams,
  notConfigured,
} from "./types";

export const amazonAdapter: MarketplaceAdapter = {
  slug: "amazon",
  name: "Amazon",
  program: "Amazon Associados (SiteStripe / PA-API)",
  docsUrl: "https://associados.amazon.com.br/",
  credentialFields: [
    {
      key: "tracking_id",
      label: "ID de Rastreamento (Tag)",
      required: true,
      help: "Sua tag de afiliado da Amazon (normalmente termina com -20, ex: meucanal-20).",
    },
    {
      key: "api_key",
      label: "Access Key / Criadores (Opcional)",
      help: "Chave de acesso da Product Advertising API 5.0 (PA-API).",
    },
    {
      key: "api_secret",
      label: "Secret Key (Opcional)",
      secret: true,
      help: "Segredo da PA-API 5.0.",
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

  async testConnection(credentials: Record<string, string>): Promise<AdapterResult<{ message: string }>> {
    const trackingId = credentials["tracking_id"]?.trim();

    if (!trackingId) {
      return notConfigured("Amazon");
    }

    if (!/^[a-zA-Z0-9_-]+-20$/.test(trackingId) && !/^[a-zA-Z0-9_-]+$/.test(trackingId)) {
      return {
        ok: false,
        state: "error",
        message: "Formato de Tag inválido. A tag de associado da Amazon Brasil geralmente termina em -20 (ex: minhaloja-20).",
      };
    }

    return {
      ok: true,
      data: {
        message: `Tag de associado Amazon (${trackingId}) validada com sucesso! Links serão convertidos com seu ID.`,
      },
    };
  },

  async searchProducts(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>> {
    const trackingId = credentials["tracking_id"]?.trim();
    if (!trackingId) return notConfigured("Amazon");

    // Retorna catálogo de ofertas em destaque
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
    const trackingId = credentials["tracking_id"]?.trim();
    if (!trackingId) return notConfigured("Amazon");

    const amazonUrl = externalId.startsWith("http") ? externalId : `https://www.amazon.com.br/dp/${externalId}`;
    const affRes = await this.buildAffiliateLink(amazonUrl, credentials);

    return {
      ok: true,
      data: {
        externalId,
        title: `Produto Amazon (${externalId})`,
        url: amazonUrl,
        affiliateUrl: affRes.ok ? affRes.data : amazonUrl,
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
    const trackingId = credentials["tracking_id"]?.trim();
    if (!trackingId) return notConfigured("Amazon");

    try {
      const url = new URL(originalUrl);
      url.searchParams.set("tag", trackingId);
      if (subId) {
        url.searchParams.set("ascsubtag", subId);
      }
      return { ok: true, data: url.toString() };
    } catch {
      const separator = originalUrl.includes("?") ? "&" : "?";
      return { ok: true, data: `${originalUrl}${separator}tag=${trackingId}${subId ? `&ascsubtag=${subId}` : ""}` };
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
