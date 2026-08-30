/**
 * SHOPEE ADAPTER — Shopee Affiliate Open API (GraphQL oficial)
 *
 * Autenticação: SHA256(AppId + timestamp + payload + Secret)
 * Endpoint: https://open-api.affiliate.shopee.com.br/graphql
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
import {
  shopeeTestConnection,
  shopeeTopSellers,
  shopeeSearchProducts,
  shopeeGenerateShortLink,
  toNumber,
  type ShopeeOfferNode,
} from "@/lib/shopee.server";

function normalizeShopeeNode(node: ShopeeOfferNode, affiliateUrl?: string): NormalizedProduct {
  const price = toNumber(node.price || node.priceMin);
  const discountRate = node.priceDiscountRate ?? 0;
  const previousPrice =
    discountRate > 0 && price > 0 ? Math.round((price / (1 - discountRate / 100)) * 100) / 100 : null;
  const commission = toNumber(node.commission);
  const commissionPct = toNumber(node.commissionRate);

  const offerLink = node.offerLink || node.productLink || "";
  const productLink = node.productLink || node.offerLink || "";

  return {
    externalId: String(node.itemId || ""),
    title: node.productName || "Produto Shopee",
    imageUrl: node.imageUrl || null,
    url: productLink,
    affiliateUrl: affiliateUrl || offerLink,
    affiliateStatus: offerLink ? "resolved" : "pending",
    source: "shopee",
    price,
    previousPrice,
    discountPct: discountRate > 0 ? discountRate : null,
    rating: node.ratingStar ? Number(node.ratingStar) : null,
    ratingCount: null,
    reviewCount: null,
    salesCount: node.sales || null,
    commission: commission > 0 ? commission : null,
    commissionPct: commissionPct > 0 ? commissionPct : null,
    freeShipping: false,
    available: true,
    syncedAt: new Date().toISOString(),
  };
}

export const shopeeAdapter: MarketplaceAdapter = {
  slug: "shopee",
  name: "Shopee",
  program: "Shopee Affiliate Open API (GraphQL)",
  docsUrl: "https://affiliate.shopee.com.br/open_api",
  credentialFields: [
    {
      key: "api_key",
      label: "App ID",
      required: true,
      placeholder: "Ex: 1234567890",
      help: "Painel Shopee Afiliados → Open API → App ID.",
    },
    {
      key: "api_secret",
      label: "Senha da API (Secret)",
      secret: true,
      required: true,
      placeholder: "Ex: abc123def456...",
      help: "Mesma tela do App ID no painel da Open API.",
    },
  ],
  capabilities: {
    searchProducts: CAP_FULL,
    listOffers: CAP_FULL,
    productDetails: { supported: true, level: "partial", reason: "Dados via productOfferV2; sem endpoint dedicado de produto" },
    affiliateLinkGeneration: CAP_FULL,
    priceData: CAP_FULL,
    imageData: CAP_FULL,
    availabilityData: { supported: true, level: "partial", reason: "Shopee não retorna disponibilidade explícita no feed" },
    autoSync: CAP_FULL,
  },
  matchesUrl: (url) => /shopee\.[a-z.]+/i.test(url),

  async testConnection(credentials) {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();

    if (!appId) return notConfigured("Shopee", "App ID");
    if (!secret) return notConfigured("Shopee", "Senha da API");

    const res = await shopeeTestConnection({ appId, secret });
    if (!res.ok) {
      return {
        ok: false,
        state: "error",
        message: `Shopee recusou as credenciais: ${res.message}`,
      };
    }

    const nodeCount = res.data.productOfferV2?.nodes?.length ?? 0;
    return {
      ok: true,
      data: {
        message: `Conectado à Shopee Open API com sucesso.`,
        details: `App ID ${appId} autenticado. ${nodeCount} produto(s) de teste recebido(s).`,
      },
    };
  },

  async searchProducts(credentials, params) {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId) return notConfigured("Shopee", "App ID");
    if (!secret) return notConfigured("Shopee", "Senha da API");

    const res = await shopeeSearchProducts({ appId, secret }, params?.keyword, params?.limit ?? 20);
    if (!res.ok) return { ok: false, state: "error", message: res.message };

    const nodes = res.data.productOfferV2?.nodes ?? [];
    return { ok: true, data: nodes.map((n) => normalizeShopeeNode(n)) };
  },

  async listOffers(credentials, params) {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId) return notConfigured("Shopee", "App ID");
    if (!secret) return notConfigured("Shopee", "Senha da API");

    const res = await shopeeTopSellers({ appId, secret }, params?.limit ?? 20);
    if (!res.ok) return { ok: false, state: "error", message: res.message };

    const nodes = res.data.productOfferV2?.nodes ?? [];
    return { ok: true, data: nodes.map((n) => normalizeShopeeNode(n)) };
  },

  async getProduct(externalId, credentials) {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId) return notConfigured("Shopee", "App ID");
    if (!secret) return notConfigured("Shopee", "Senha da API");

    const res = await shopeeSearchProducts({ appId, secret }, externalId, 1);
    if (!res.ok) return { ok: false, state: "error", message: res.message };

    const node = res.data.productOfferV2?.nodes?.[0];
    if (!node) {
      return { ok: false, state: "error", message: `Produto ${externalId} não encontrado na Shopee.` };
    }

    return { ok: true, data: normalizeShopeeNode(node) };
  },

  async buildAffiliateLink(originalUrl, credentials, subId) {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId) return notConfigured("Shopee", "App ID");
    if (!secret) return notConfigured("Shopee", "Senha da API");

    const res = await shopeeGenerateShortLink({ appId, secret }, originalUrl, subId);
    if (!res.ok) {
      return {
        ok: false,
        state: "error",
        message: `Shopee não gerou o link de afiliado: ${res.message}`,
      };
    }

    const shortLink = res.data.generateShortLink?.shortLink;
    if (!shortLink) {
      return {
        ok: false,
        state: "error",
        message: "Shopee retornou resposta vazia para generateShortLink.",
      };
    }

    return { ok: true, data: shortLink };
  },

  async syncOffers(credentials, params) {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId) return notConfigured("Shopee", "App ID");
    if (!secret) return notConfigured("Shopee", "Senha da API");

    const res = await shopeeTopSellers({ appId, secret }, params?.limit ?? 50);
    if (!res.ok) return { ok: false, state: "error", message: res.message };

    const nodes = res.data.productOfferV2?.nodes ?? [];
    const errors: string[] = [];
    const products: NormalizedProduct[] = [];
    let skipped = 0;

    for (const node of nodes) {
      if (!node.itemId || !node.productName) {
        skipped++;
        errors.push(`Produto ignorado: dados incompletos (itemId=${node.itemId})`);
        continue;
      }
      if (toNumber(node.price || node.priceMin) <= 0) {
        skipped++;
        errors.push(`Produto ignorado: preço inválido (${node.itemId})`);
        continue;
      }
      products.push(normalizeShopeeNode(node));
    }

    return {
      ok: true,
      data: {
        found: nodes.length,
        imported: products.length,
        skipped,
        errors,
        products,
      },
    };
  },
};
