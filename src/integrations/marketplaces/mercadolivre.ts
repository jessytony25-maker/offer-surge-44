/**
 * MERCADO LIVRE ADAPTER
 *
 * Dois componentes claramente separados:
 *
 * 1. CATÁLOGO (api.mercadolibre.com) — exige OAuth. Chamadas anônimas são
 *    recusadas com HTTP 403 (PolicyAgent). Sem access token válido não há catálogo.
 * 2. AFILIADOS — o link só é considerado real quando a URL oficial do produto
 *    recebe os parâmetros de rastreamento matt_word/matt_tool e passa na validação.
 *    Nunca é gerado link fictício: sem parâmetros válidos, affiliateStatus = "pending".
 */

import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  type SyncReport,
  CAP_FULL,
} from "./types";
import {
  applyMattParams,
  credsFromRecord,
  extractMeliId,
  meliFetch,
  meliTestAuth,
  validateAffiliateUrl,
} from "@/lib/mercadolivre.server";

function normalizeMeliItem(item: any, affiliateUrl?: string | null): NormalizedProduct {
  const price = typeof item.price === "number" ? item.price : 0;
  const originalPrice = typeof item.original_price === "number" ? item.original_price : null;
  const discountPct =
    originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  const rawImage = item.thumbnail || item.pictures?.[0]?.url || "";
  const imageUrl = rawImage.replace(/-I\.jpg$/i, "-O.jpg").replace(/^http:\/\//i, "https://");
  const permalink = item.permalink || "";

  return {
    externalId: String(item.id || ""),
    title: item.title || "Produto Mercado Livre",
    imageUrl: imageUrl || null,
    url: permalink,
    // Sem link de afiliado real, mantemos a URL original e o status pendente.
    affiliateUrl: affiliateUrl || permalink,
    affiliateStatus: affiliateUrl ? "resolved" : "pending",
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
  program: "Mercado Livre Afiliados + API de Catálogo (OAuth)",
  docsUrl: "https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao",
  credentialFields: [
    {
      key: "client_id",
      label: "Client ID (App ID)",
      required: true,
      placeholder: "Ex: 1234567890123456",
      help: "Mercado Livre Developers → suas aplicações → App ID.",
    },
    {
      key: "client_secret",
      label: "Client Secret",
      secret: true,
      required: true,
      placeholder: "Ex: abc123...",
      help: "Chave secreta da mesma aplicação. Usada apenas no servidor para renovar o token.",
    },
    {
      key: "access_token",
      label: "Access Token OAuth",
      secret: true,
      required: true,
      placeholder: "APP_USR-...",
      help: "Obrigatório: a API do Mercado Livre recusa (HTTP 403) qualquer consulta sem token.",
    },
    {
      key: "refresh_token",
      label: "Refresh Token",
      secret: true,
      placeholder: "TG-...",
      help: "Permite renovar o access token automaticamente quando ele expira (~6h).",
    },
    {
      key: "affiliate_id",
      label: "Etiqueta de Afiliado (matt_word)",
      placeholder: "Ex: seu_id_afiliado",
      help: "Parâmetro matt_word do seu link de afiliado. Sem ele o link não é considerado afiliado.",
    },
    {
      key: "tracking_id",
      label: "ID da Ferramenta (matt_tool)",
      placeholder: "Ex: 12345678",
      help: "Parâmetro matt_tool do seu link de afiliado.",
    },
  ],
  capabilities: {
    searchProducts: { supported: true, level: "partial", reason: "Requer access token OAuth válido (403 sem token)" },
    listOffers: { supported: true, level: "partial", reason: "Requer access token OAuth válido" },
    productDetails: { supported: true, level: "partial", reason: "Requer access token OAuth válido" },
    affiliateLinkGeneration: {
      supported: true,
      level: "partial",
      reason:
        "Parâmetros oficiais matt_word/matt_tool. Contas cujo programa exige a extensão do Mercado Livre precisam gerar o link pela extensão.",
    },
    priceData: CAP_FULL,
    imageData: CAP_FULL,
    availabilityData: CAP_FULL,
    autoSync: { supported: true, level: "partial", reason: "Só é liberado após a conexão ser validada" },
  },
  matchesUrl: (url) => /(mercadolivre|mercadolibre)\.[a-z.]+/i.test(url),

  async testConnection(credentials): Promise<AdapterResult<{ message: string; details?: string }>> {
    const creds = credsFromRecord(credentials);

    // Verificação rápida: apenas /users/me — não roda diagnóstico completo de 10 etapas
    const auth = await meliTestAuth(creds);

    if (!auth.ok) {
      // HTTP 403 sem token: mensagem específica, não "erro de rede"
      const isNoToken = auth.httpStatus === null && !creds.accessToken;
      return {
        ok: false,
        state: isNoToken ? "not_configured" : "error",
        message: auth.message,
      };
    }

    const affiliateStatus = auth.hasMatt
      ? "Links de afiliado via matt_word/matt_tool configurados."
      : "⚠️ matt_word/matt_tool não configurados — links de afiliado usarão URL original (pendente). Configure-os no formulário de credenciais.";

    return {
      ok: true,
      data: {
        message: `Mercado Livre conectado como "${auth.nickname}". ${affiliateStatus}`,
        details: `Conta verificada via GET /users/me (HTTP 200). ID: ${auth.userId}.`,
      },
    };
  },

  async searchProducts(credentials, params): Promise<AdapterResult<NormalizedProduct[]>> {
    const keyword = params?.keyword || "ofertas";
    const limit = params?.limit || 20;
    const offset = (params as any)?.offset || 0;
    const creds = credsFromRecord(credentials);

    const res = await meliFetch<{ results?: any[] }>(
      `/sites/MLB/search?q=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`,
      creds,
      { step: "catalog" },
    );
    if (!res.ok) {
      return { ok: false, state: res.httpStatus === null ? "error" : "error", message: res.message };
    }

    const items = res.data.results ?? [];
    const products = items.map((item) => {
      const affiliate =
        creds.mattWord && creds.mattTool
          ? applyMattParams(item.permalink || "", creds.mattWord, creds.mattTool)
          : null;
      const valid =
        affiliate && validateAffiliateUrl(affiliate, creds.mattWord!, creds.mattTool!) ? affiliate : null;
      return normalizeMeliItem(item, valid);
    });

    return { ok: true, data: products };
  },

  async listOffers(credentials, params): Promise<AdapterResult<NormalizedProduct[]>> {
    // Termos populares para trazer variedade real no catálogo se nenhum termo for especificado
    const POPULAR_TERMS = [
      "celular",
      "fone bluetooth",
      "air fryer",
      "lavadora de alta pressao",
      "tenis",
      "eletronicos",
      "casa e cozinha",
      "ferramentas",
      "beleza",
    ];
    const term = params?.keyword || POPULAR_TERMS[Math.floor(Math.random() * POPULAR_TERMS.length)] || "ofertas";
    return this.searchProducts(credentials, { ...params, keyword: term });
  },

  async getProduct(externalId, credentials): Promise<AdapterResult<NormalizedProduct>> {
    const creds = credsFromRecord(credentials);

    // externalId pode ser um ID direto (MLB1234) ou uma URL completa
    let itemId = externalId;
    if (externalId.startsWith("http")) {
      const extracted = extractMeliId(externalId);
      if (!extracted) {
        return {
          ok: false,
          state: "error",
          message: `Não foi possível extrair o ID do produto da URL: ${externalId}. Use uma URL no formato https://produto.mercadolivre.com.br/MLB-XXXXXXXX`,
        };
      }
      itemId = extracted;
    }

    const res = await meliFetch<any>(`/items/${encodeURIComponent(itemId)}`, creds, { step: "product" });
    if (!res.ok) return { ok: false, state: "error", message: res.message };

    const item = res.data;
    const affiliate =
      creds.mattWord && creds.mattTool
        ? applyMattParams(item.permalink || "", creds.mattWord, creds.mattTool)
        : null;
    const validAffiliate =
      affiliate && validateAffiliateUrl(affiliate, creds.mattWord!, creds.mattTool!) ? affiliate : null;
    return { ok: true, data: normalizeMeliItem(item, validAffiliate) };
  },

  async buildAffiliateLink(originalUrl, credentials, subId): Promise<AdapterResult<string>> {
    const creds = credsFromRecord(credentials);
    if (!creds.mattWord || !creds.mattTool) {
      return {
        ok: false,
        state: "not_configured",
        message:
          "Link de afiliado do Mercado Livre não gerado: informe matt_word e matt_tool. Se o seu programa exige a ferramenta oficial, a extensão do Mercado Livre é necessária para gerar o link afiliado.",
      };
    }

    const url = applyMattParams(originalUrl, creds.mattWord, creds.mattTool, subId);
    if (!url || !validateAffiliateUrl(url, creds.mattWord, creds.mattTool)) {
      return {
        ok: false,
        state: "error",
        message: `URL inválida para afiliação do Mercado Livre: ${originalUrl}. O link precisa ser uma URL oficial do domínio mercadolivre.com.br.`,
      };
    }
    return { ok: true, data: url };
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
        errors.push(`Item ignorado por falta de dados básicos (id=${item.externalId}).`);
        continue;
      }
      if (item.price <= 0) {
        skipped++;
        errors.push(`Item ${item.externalId} ignorado por preço zerado.`);
        continue;
      }
      // Não descartamos produtos com affiliateStatus !== "resolved", pois
      // a URL ORIGINAL é preservada e a extensão oficial do Mercado Livre
      // no Chrome cuidará da conversão/tracking na navegação.
      products.push(item);
    }

    return {
      ok: true,
      data: { found: items.length, imported: products.length, skipped, errors, products },
    };
  },
};

