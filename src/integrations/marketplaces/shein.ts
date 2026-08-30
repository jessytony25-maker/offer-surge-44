/**
 * SHEIN ADAPTER
 *
 * Integração baseada no programa de afiliados direto da SHEIN (br.shein.com).
 * A busca automática de catálogo/ofertas de forma direta não é suportada por API pública.
 * Por isso, as capacidades de catálogo estão marcadas como indisponíveis,
 * permitindo que a geração/conversão de links de afiliados funcione com o ID do usuário.
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

export const sheinAdapter: MarketplaceAdapter = {
  slug: "shein",
  name: "SHEIN",
  program: "SHEIN Afiliados (Portal Direto)",
  docsUrl: "https://br.shein.com/Affiliate-Program-a-1229.html",
  credentialFields: [
    {
      key: "affiliate_id",
      label: "ID de Afiliado (aff_id)",
      required: true,
      placeholder: "Ex: 12345",
      help: "Seu ID de afiliado da SHEIN obtido no painel de afiliados.",
    },
    {
      key: "tracking_id",
      label: "Sub-ID / Campanha (Opcional)",
      placeholder: "Ex: canaltelegram",
      help: "Identificador de campanha de afiliado.",
    },
  ],
  capabilities: {
    searchProducts: CAP_UNAVAILABLE("A SHEIN não fornece API pública de pesquisa de catálogo para afiliados diretos."),
    listOffers: CAP_UNAVAILABLE("A listagem automática de ofertas da SHEIN requer feed XML de rede parceira."),
    productDetails: CAP_UNAVAILABLE("Dados de detalhe de produto via API não estão disponíveis."),
    affiliateLinkGeneration: CAP_LINK_ONLY("Geração local de link de afiliado através do ID do afiliado (aff_id)"),
    priceData: CAP_UNAVAILABLE("Preços automatizados via API indisponíveis para SHEIN."),
    imageData: CAP_UNAVAILABLE("Download de imagens de produto via API indisponível."),
    availabilityData: CAP_UNAVAILABLE("Monitoramento de estoque indisponível para SHEIN."),
    autoSync: CAP_UNAVAILABLE("Sincronização automática indisponível sem feed de rede parceira."),
  },
  matchesUrl: (url) => /shein\.[a-z.]+/i.test(url),

  async testConnection(credentials): Promise<AdapterResult<{ message: string; details?: string }>> {
    const affiliateId = credentials["affiliate_id"]?.trim();

    if (!affiliateId) {
      return notConfigured("SHEIN", "ID de Afiliado (aff_id)");
    }

    if (!/^\d+$/.test(affiliateId)) {
      return {
        ok: false,
        state: "error",
        message: "ID de Afiliado inválido. O ID do portal direto da SHEIN deve conter apenas números (ex: 54321).",
      };
    }

    return {
      ok: true,
      data: {
        message: `ID de afiliado SHEIN (${affiliateId}) validado com sucesso para conversão de links!`,
        details: "Apenas conversão local de links está ativa. A busca automática de ofertas não está disponível nesta modalidade.",
      },
    };
  },

  async searchProducts(credentials, params): Promise<AdapterResult<NormalizedProduct[]>> {
    return notSupported("SHEIN", "A SHEIN não fornece API pública de busca de produtos.");
  },

  async listOffers(credentials, params): Promise<AdapterResult<NormalizedProduct[]>> {
    return notSupported("SHEIN", "A sincronização de ofertas automáticas não é suportada diretamente via API.");
  },

  async getProduct(externalId, credentials): Promise<AdapterResult<NormalizedProduct>> {
    const affiliateId = credentials["affiliate_id"]?.trim();
    if (!affiliateId) return notConfigured("SHEIN", "ID de Afiliado (aff_id)");

    const sheinUrl = externalId.startsWith("http") ? externalId : `https://br.shein.com/product-p-${externalId}.html`;
    const affRes = await this.buildAffiliateLink(sheinUrl, credentials);

    return {
      ok: true,
      data: {
        externalId,
        title: `Produto SHEIN (${externalId})`,
        url: sheinUrl,
        affiliateUrl: affRes.ok ? affRes.data : sheinUrl,
        affiliateStatus: "resolved",
        source: "shein",
        price: 0,
        available: true,
        syncedAt: new Date().toISOString(),
      },
    };
  },

  async buildAffiliateLink(originalUrl, credentials, subId): Promise<AdapterResult<string>> {
    const affiliateId = credentials["affiliate_id"]?.trim();
    if (!affiliateId) return notConfigured("SHEIN", "ID de Afiliado (aff_id)");

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

  async syncOffers(credentials, params): Promise<AdapterResult<SyncReport>> {
    return notSupported("SHEIN", "A sincronização de ofertas automáticas não é suportada.");
  },
};
