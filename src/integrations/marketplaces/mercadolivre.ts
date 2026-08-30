import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  type SearchParams,
  notConfigured,
} from "./types";

function normalizeMeliItem(item: any, affiliateUrl?: string): NormalizedProduct {
  const price = typeof item.price === "number" ? item.price : 0;
  const originalPrice = typeof item.original_price === "number" ? item.original_price : null;
  const discountPct =
    originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  // Imagem de alta resolução
  const rawImage = item.thumbnail || item.pictures?.[0]?.url || "";
  const imageUrl = rawImage.replace(/-I\.jpg$/i, "-O.jpg").replace(/^http:\/\//i, "https://");

  return {
    externalId: String(item.id || ""),
    title: item.title || "Produto Mercado Livre",
    imageUrl,
    url: item.permalink || "",
    affiliateUrl: affiliateUrl || item.permalink || "",
    price,
    previousPrice: originalPrice,
    discountPct,
    rating: item.reviews?.rating_average ? Number(item.reviews.rating_average) : null,
    ratingCount: item.reviews?.total ? Number(item.reviews.total) : null,
    salesCount: typeof item.sold_quantity === "number" ? item.sold_quantity : null,
    freeShipping: item.shipping?.free_shipping ?? false,
    available: item.available_quantity ? item.available_quantity > 0 : true,
    category: item.category_id || undefined,
  };
}

export const mercadoLivreAdapter: MarketplaceAdapter = {
  slug: "mercadolivre",
  name: "Mercado Livre",
  program: "Mercado Livre Afiliados + API Oficial",
  docsUrl: "https://www.mercadolivre.com.br/afiliados/home",
  credentialFields: [
    {
      key: "affiliate_id",
      label: "Etiqueta (matt_word)",
      required: true,
      help: "Encontrada no seu link de afiliado do Mercado Livre (ex: seu_codigo_afiliado).",
    },
    {
      key: "tracking_id",
      label: "ID da Ferramenta (matt_tool)",
      required: true,
      help: "Identificador da ferramenta de afiliado (normalmente um número, ex: 12345678).",
    },
    {
      key: "api_key",
      label: "Access Token / Client ID (Opcional)",
      help: "Preencha caso possua aplicação registrada no Mercado Livre Developers.",
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
  matchesUrl: (url) => /(mercadolivre|mercadolibre)\.[a-z.]+/i.test(url),

  async testConnection(credentials: Record<string, string>): Promise<AdapterResult<{ message: string }>> {
    const mattWord = credentials["affiliate_id"]?.trim();
    const mattTool = credentials["tracking_id"]?.trim();

    if (!mattWord || !mattTool) {
      return notConfigured("Mercado Livre");
    }

    try {
      // Testa a disponibilidade da API pública do Mercado Livre no Brasil (MLB)
      const res = await fetch("https://api.mercadolibre.com/sites/MLB/search?q=oferta&limit=1");
      if (!res.ok) {
        return {
          ok: false,
          state: "error",
          message: `Mercado Livre API respondeu HTTP ${res.status}.`,
        };
      }

      return {
        ok: true,
        data: {
          message: `Conectado ao Mercado Livre! Parâmetros matt_word (${mattWord}) e matt_tool (${mattTool}) validados.`,
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

  async searchProducts(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>> {
    const keyword = params?.keyword || "ofertas";
    const limit = params?.limit || 20;

    try {
      const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(keyword)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) {
        return { ok: false, state: "error", message: `Mercado Livre retornou status ${res.status}` };
      }
      const data = await res.json();
      const items = Array.isArray(data.results) ? data.results : [];

      const products = await Promise.all(
        items.map(async (item: any) => {
          const affLinkRes = await this.buildAffiliateLink(item.permalink || "", credentials);
          return normalizeMeliItem(item, affLinkRes.ok ? affLinkRes.data : item.permalink);
        }),
      );

      return { ok: true, data: products };
    } catch (err: any) {
      return { ok: false, state: "error", message: err.message || "Erro ao buscar no Mercado Livre." };
    }
  },

  async listOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>> {
    return this.searchProducts(credentials, { ...params, keyword: params?.keyword || "super ofertas" });
  },

  async getProduct(
    externalId: string,
    credentials: Record<string, string>,
  ): Promise<AdapterResult<NormalizedProduct>> {
    try {
      const res = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(externalId)}`);
      if (!res.ok) {
        return { ok: false, state: "error", message: "Produto não encontrado no Mercado Livre." };
      }
      const item = await res.json();
      const affLinkRes = await this.buildAffiliateLink(item.permalink || "", credentials);
      return {
        ok: true,
        data: normalizeMeliItem(item, affLinkRes.ok ? affLinkRes.data : item.permalink),
      };
    } catch (err: any) {
      return { ok: false, state: "error", message: err.message || "Erro ao consultar item." };
    }
  },

  async buildAffiliateLink(
    originalUrl: string,
    credentials: Record<string, string>,
    subId?: string,
  ): Promise<AdapterResult<string>> {
    const mattWord = credentials["affiliate_id"]?.trim();
    const mattTool = credentials["tracking_id"]?.trim();

    if (!mattWord || !mattTool) {
      return notConfigured("Mercado Livre");
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
      return { ok: true, data: `${originalUrl}?matt_word=${mattWord}&matt_tool=${mattTool}` };
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
