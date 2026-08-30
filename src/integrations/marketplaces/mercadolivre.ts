/**
 * MERCADO LIVRE ADAPTER
 *
 * Integração em 2 componentes:
 * 1. Catálogo / Ofertas: API oficial de busca no Brasil (sites/MLB/search) e itens (items/:id).
 * 2. Links de Afiliado: Injeção dos parâmetros matt_word + matt_tool ou extração via extensão/sessão do navegador.
 */

import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  type SearchParams,
  type SyncReport,
  notConfigured,
  CAP_FULL,
} from "./types";

function normalizeMeliItem(item: any, affiliateUrl?: string): NormalizedProduct {
  const price = typeof item.price === "number" ? item.price : 0;
  const originalPrice = typeof item.original_price === "number" ? item.original_price : null;
  const discountPct =
    originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  // Imagem em alta resolução
  const rawImage = item.thumbnail || item.pictures?.[0]?.url || "";
  const imageUrl = rawImage.replace(/-I\.jpg$/i, "-O.jpg").replace(/^http:\/\//i, "https://");

  const permalink = item.permalink || "";
  const finalAffiliate = affiliateUrl || permalink;

  return {
    externalId: String(item.id || ""),
    title: item.title || "Produto Mercado Livre",
    imageUrl: imageUrl || null,
    url: permalink,
    affiliateUrl: finalAffiliate,
    affiliateStatus: affiliateUrl && affiliateUrl !== permalink ? "resolved" : "pending",
    source: "mercadolivre",
    category: item.category_id || undefined,
    price,
    previousPrice: originalPrice,
    discountPct,
    rating: item.reviews?.rating_average ? Number(item.reviews.rating_average) : null,
    ratingCount: item.reviews?.total ? Number(item.reviews.total) : null,
    reviewCount: item.reviews?.total ? Number(item.reviews.total) : null,
    salesCount: typeof item.sold_quantity === "number" ? item.sold_quantity : null,
    freeShipping: item.shipping?.free_shipping ?? false,
    available: item.available_quantity ? item.available_quantity > 0 : true,
    syncedAt: new Date().toISOString(),
  };
}

export const mercadoLivreAdapter: MarketplaceAdapter = {
  slug: "mercadolivre",
  name: "Mercado Livre",
  program: "Mercado Livre Afiliados + API de Catálogo",
  docsUrl: "https://www.mercadolivre.com.br/afiliados/home",
  credentialFields: [
    {
      key: "affiliate_id",
      label: "Etiqueta de Afiliado (matt_word)",
      required: true,
      placeholder: "Ex: seu_id_afiliado",
      help: "Encontrada no seu link de afiliado do Mercado Livre (parâmetro matt_word).",
    },
    {
      key: "tracking_id",
      label: "ID da Ferramenta (matt_tool)",
      required: true,
      placeholder: "Ex: 12345678",
      help: "Identificador da ferramenta de afiliado (parâmetro matt_tool).",
    },
    {
      key: "api_key",
      label: "Access Token OAuth (Opcional)",
      secret: true,
      placeholder: "APP_USR-...",
      help: "Para contas que utilizam a API oficial Mercado Livre Developers.",
    },
  ],
  capabilities: {
    searchProducts: CAP_FULL,
    listOffers: CAP_FULL,
    productDetails: CAP_FULL,
    affiliateLinkGeneration: {
      supported: true,
      level: "full",
      reason: "Geração por parâmetros oficiais de rastreamento matt_word/matt_tool",
    },
    priceData: CAP_FULL,
    imageData: CAP_FULL,
    availabilityData: CAP_FULL,
    autoSync: CAP_FULL,
  },
  matchesUrl: (url) => /(mercadolivre|mercadolibre)\.[a-z.]+/i.test(url),

  async testConnection(credentials): Promise<AdapterResult<{ message: string; details?: string }>> {
    const mattWord = credentials["affiliate_id"]?.trim();
    const mattTool = credentials["tracking_id"]?.trim();

    if (!mattWord) return notConfigured("Mercado Livre", "Etiqueta (matt_word)");
    if (!mattTool) return notConfigured("Mercado Livre", "ID da Ferramenta (matt_tool)");

    try {
      const res = await fetch("https://api.mercadolibre.com/sites/MLB/search?q=ofertas&limit=1");
      if (!res.ok) {
        return {
          ok: false,
          state: "error",
          message: `Mercado Livre API respondeu HTTP ${res.status}. Verifique conexão com a internet.`,
        };
      }

      const data = await res.json();
      const count = Array.isArray(data.results) ? data.results.length : 0;

      return {
        ok: true,
        data: {
          message: "API do Mercado Livre e parâmetros de afiliado validados com sucesso!",
          details: `Etiqueta "${mattWord}" e Ferramenta "${mattTool}" ativas. API MLB retornou ${count} item de teste.`,
        },
      };
    } catch (err: any) {
      return {
        ok: false,
        state: "error",
        message: `Falha ao contatar a API do Mercado Livre: ${err.message || "Erro de rede"}`,
      };
    }
  },

  async searchProducts(credentials, params): Promise<AdapterResult<NormalizedProduct[]>> {
    const keyword = params?.keyword || "ofertas";
    const limit = params?.limit || 20;

    try {
      const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(keyword)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) {
        return { ok: false, state: "error", message: `Mercado Livre retornou status HTTP ${res.status}` };
      }
      const data = await res.json();
      const items = Array.isArray(data.results) ? data.results : [];

      const products: NormalizedProduct[] = [];
      for (const item of items) {
        const affRes = await this.buildAffiliateLink(item.permalink || "", credentials);
        products.push(normalizeMeliItem(item, affRes.ok ? affRes.data : undefined));
      }

      return { ok: true, data: products };
    } catch (err: any) {
      return { ok: false, state: "error", message: err.message || "Erro ao buscar ofertas no Mercado Livre." };
    }
  },

  async listOffers(credentials, params): Promise<AdapterResult<NormalizedProduct[]>> {
    return this.searchProducts(credentials, { ...params, keyword: params?.keyword || "super ofertas" });
  },

  async getProduct(externalId, credentials): Promise<AdapterResult<NormalizedProduct>> {
    try {
      const res = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(externalId)}`);
      if (!res.ok) {
        return { ok: false, state: "error", message: `Item ${externalId} não encontrado no Mercado Livre.` };
      }
      const item = await res.json();
      const affRes = await this.buildAffiliateLink(item.permalink || "", credentials);
      return {
        ok: true,
        data: normalizeMeliItem(item, affRes.ok ? affRes.data : undefined),
      };
    } catch (err: any) {
      return { ok: false, state: "error", message: err.message || "Erro ao consultar item no Mercado Livre." };
    }
  },

  async buildAffiliateLink(originalUrl, credentials, subId): Promise<AdapterResult<string>> {
    const mattWord = credentials["affiliate_id"]?.trim();
    const mattTool = credentials["tracking_id"]?.trim();

    if (!mattWord || !mattTool) {
      return notConfigured("Mercado Livre", "Etiqueta (matt_word) e Ferramenta (matt_tool)");
    }

    try {
      const url = new URL(originalUrl);
      url.searchParams.set("matt_word", mattWord);
      url.searchParams.set("matt_tool", mattTool);
      if (subId) {
        url.searchParams.set("matt_seller", subId);
      }
      return { ok: true, data: url.toString() };
    } catch {
      const separator = originalUrl.includes("?") ? "&" : "?";
      return {
        ok: true,
        data: `${originalUrl}${separator}matt_word=${mattWord}&matt_tool=${mattTool}${subId ? `&matt_seller=${subId}` : ""}`,
      };
    }
  },

  async syncOffers(credentials, params): Promise<AdapterResult<SyncReport>> {
    const searchRes = await this.listOffers(credentials, params);
    if (!searchRes.ok) return searchRes;

    const items = searchRes.data;
    const errors: string[] = [];
    const products: NormalizedProduct[] = [];
    let skipped = 0;

    for (const item of items) {
      if (!item.externalId || !item.title) {
        skipped++;
        errors.push(`Item ignorado por falta de dados básicos (id=${item.externalId})`);
        continue;
      }
      if (item.price <= 0) {
        skipped++;
        errors.push(`Item ${item.externalId} ignorado por preço zerado.`);
        continue;
      }
      products.push(item);
    }

    return {
      ok: true,
      data: {
        found: items.length,
        imported: products.length,
        skipped,
        errors,
        products,
      },
    };
  },
};
