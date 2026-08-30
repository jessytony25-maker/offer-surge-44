/**
 * AMAZON ADAPTER
 *
 * Implementação utilizando os recursos de associado da Amazon.
 * Sem chaves da PA-API 5.0 (Access Key, Secret Key), as capacidades de busca de produtos e
 * listagem de ofertas retornam um erro descritivo explicando que o recurso não está disponível sem API.
 * A geração de links de afiliados (Link Conversion) é totalmente ativa via Tag de rastreamento (?tag=).
 */

import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  type SearchParams,
  type SyncReport,
  notConfigured,
  notSupported,
  CAP_LINK_ONLY,
  CAP_UNAVAILABLE,
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
      placeholder: "Ex: meucanal-20",
      help: "Sua tag de afiliado da Amazon (normalmente termina com -20 no Brasil).",
    },
    {
      key: "api_key",
      label: "Access Key PA-API (Opcional)",
      placeholder: "Ex: AKIA...",
      help: "Chave de acesso da Product Advertising API 5.0 (PA-API). Requer aprovação da Amazon.",
    },
    {
      key: "api_secret",
      label: "Secret Key PA-API (Opcional)",
      secret: true,
      placeholder: "Ex: abc/def...",
      help: "Segredo da PA-API 5.0.",
    },
  ],
  capabilities: {
    searchProducts: CAP_UNAVAILABLE("Busca de catálogo requer credenciais da PA-API 5.0 qualificadas."),
    listOffers: CAP_UNAVAILABLE("Sincronização de ofertas requer acesso aprovado à PA-API 5.0."),
    productDetails: CAP_UNAVAILABLE("Consulta de detalhes de produto requer PA-API 5.0."),
    affiliateLinkGeneration: CAP_LINK_ONLY("Conversão local de links de produtos via tag de rastreamento"),
    priceData: CAP_UNAVAILABLE("Preços dinâmicos requerem PA-API 5.0."),
    imageData: CAP_UNAVAILABLE("Imagens de produto da API requerem PA-API 5.0."),
    availabilityData: CAP_UNAVAILABLE("Verificação de estoque requer PA-API 5.0."),
    autoSync: CAP_UNAVAILABLE("A sincronização automática de ofertas da Amazon requer PA-API 5.0."),
  },
  matchesUrl: (url) => /amazon\.[a-z.]+|amzn\.to/i.test(url),

  async testConnection(credentials): Promise<AdapterResult<{ message: string; details?: string }>> {
    const trackingId = credentials["tracking_id"]?.trim();
    const apiKey = credentials["api_key"]?.trim();
    const apiSecret = credentials["api_secret"]?.trim();

    if (!trackingId) {
      return notConfigured("Amazon", "Tag de Rastreamento");
    }

    if (!/^[a-zA-Z0-9_-]+-20$/.test(trackingId) && !/^[a-zA-Z0-9_-]+$/.test(trackingId)) {
      return {
        ok: false,
        state: "error",
        message: "Formato de Tag de Rastreamento inválido. A tag deve seguir o formato padrão da Amazon (ex: minhaloja-20).",
      };
    }

    const hasKeys = Boolean(apiKey && apiSecret);
    if (!hasKeys) {
      return {
        ok: true,
        data: {
          message: `Tag de associado Amazon (${trackingId}) configurada com sucesso para conversão de links!`,
          details: "Apenas conversão local de links está ativa. Busca automática de ofertas desabilitada (requer chaves da PA-API 5.0).",
        },
      };
    }

    return {
      ok: true,
      data: {
        message: `Tag Amazon (${trackingId}) e chaves da PA-API configuradas!`,
        details: "O acesso à API da Amazon está sujeito às regras de vendas aprovadas (mínimo de 3 vendas nos últimos 180 dias).",
      },
    };
  },

  async searchProducts(credentials, params): Promise<AdapterResult<NormalizedProduct[]>> {
    const apiKey = credentials["api_key"]?.trim();
    const apiSecret = credentials["api_secret"]?.trim();

    if (!apiKey || !apiSecret) {
      return notSupported("Amazon", "Esta conta não tem acesso à API de Busca (PA-API 5.0) configurada. Adicione as chaves de API nas configurações.");
    }

    return {
      ok: true,
      data: [],
    };
  },

  async listOffers(credentials, params): Promise<AdapterResult<NormalizedProduct[]>> {
    return this.searchProducts(credentials, params);
  },

  async getProduct(externalId, credentials): Promise<AdapterResult<NormalizedProduct>> {
    const trackingId = credentials["tracking_id"]?.trim();
    if (!trackingId) return notConfigured("Amazon", "Tag de Rastreamento");

    const amazonUrl = externalId.startsWith("http") ? externalId : `https://www.amazon.com.br/dp/${externalId}`;
    const affRes = await this.buildAffiliateLink(amazonUrl, credentials);

    return {
      ok: true,
      data: {
        externalId,
        title: `Produto Amazon (${externalId})`,
        url: amazonUrl,
        affiliateUrl: affRes.ok ? affRes.data : amazonUrl,
        affiliateStatus: "resolved",
        source: "amazon",
        price: 0,
        available: true,
        syncedAt: new Date().toISOString(),
      },
    };
  },

  async buildAffiliateLink(originalUrl, credentials, subId): Promise<AdapterResult<string>> {
    const trackingId = credentials["tracking_id"]?.trim();
    if (!trackingId) return notConfigured("Amazon", "Tag de Rastreamento");

    try {
      const url = new URL(originalUrl);
      url.searchParams.set("tag", trackingId);
      if (subId) {
        url.searchParams.set("ascsubtag", subId);
      }
      return { ok: true, data: url.toString() };
    } catch {
      const separator = originalUrl.includes("?") ? "&" : "?";
      return {
        ok: true,
        data: `${originalUrl}${separator}tag=${trackingId}${subId ? `&ascsubtag=${subId}` : ""}`,
      };
    }
  },

  async syncOffers(credentials, params): Promise<AdapterResult<SyncReport>> {
    const apiKey = credentials["api_key"]?.trim();
    const apiSecret = credentials["api_secret"]?.trim();

    if (!apiKey || !apiSecret) {
      return notSupported("Amazon", "A sincronização de ofertas requer chaves da PA-API 5.0.");
    }

    return {
      ok: true,
      data: {
        found: 0,
        imported: 0,
        skipped: 0,
        errors: ["PA-API não ativada ou sem permissões da conta da Amazon."],
        products: [],
      },
    };
  },
};
