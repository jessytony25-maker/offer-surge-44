import {
  type MarketplaceAdapter,
  type AdapterResult,
  type NormalizedProduct,
  type SearchParams,
  notConfigured,
} from "./types";
import {
  shopeeTestConnection,
  shopeeTopSellers,
  shopeeSearchProducts,
  shopeeGenerateShortLink,
  toNumber,
  type ShopeeOfferNode,
} from "@/lib/shopee.server";

function normalizeShopeeNode(node: ShopeeOfferNode): NormalizedProduct {
  const price = toNumber(node.price || node.priceMin);
  const discountRate = node.priceDiscountRate || 0;
  const previousPrice = discountRate > 0 && price > 0 ? price / (1 - discountRate / 100) : null;
  const commission = toNumber(node.commission);
  const commissionPct = toNumber(node.commissionRate);

  return {
    externalId: String(node.itemId || ""),
    title: node.productName || "Produto Shopee",
    imageUrl: node.imageUrl || "",
    url: node.productLink || node.offerLink || "",
    affiliateUrl: node.offerLink || node.productLink || "",
    price,
    previousPrice: previousPrice ? Math.round(previousPrice * 100) / 100 : null,
    discountPct: discountRate,
    rating: node.ratingStar ? Number(node.ratingStar) : null,
    salesCount: node.sales || null,
    commission: commission > 0 ? commission : null,
    commissionPct: commissionPct > 0 ? commissionPct : null,
    available: true,
  };
}

/**
 * Shopee — Shopee Affiliate Open API Oficial (GraphQL).
 * Conexão direta via App ID + Senha da API (Secret).
 */
export const shopeeAdapter: MarketplaceAdapter = {
  slug: "shopee",
  name: "Shopee",
  program: "Shopee Affiliate Open API (Oficial)",
  docsUrl: "https://affiliate.shopee.com.br/open_api",
  credentialFields: [
    {
      key: "api_key",
      label: "App ID",
      required: true,
      help: "Painel de Afiliados Shopee → Open API → App ID.",
    },
    {
      key: "api_secret",
      label: "Senha da API (Secret)",
      secret: true,
      required: true,
      help: "Mesma tela do App ID no painel da Open API.",
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
  matchesUrl: (url) => /shopee\.[a-z.]+/i.test(url),

  async testConnection(credentials: Record<string, string>): Promise<AdapterResult<{ message: string }>> {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();

    if (!appId || !secret) {
      return notConfigured("Shopee");
    }

    const res = await shopeeTestConnection({ appId, secret });
    if (!res.ok) {
      return {
        ok: false,
        state: "error",
        message: res.message || "App ID ou Senha da API inválidos na Shopee.",
      };
    }

    return {
      ok: true,
      data: { message: "Conexão com a Shopee Open API verificada com sucesso!" },
    };
  },

  async searchProducts(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>> {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId || !secret) return notConfigured("Shopee");

    const res = await shopeeSearchProducts({ appId, secret }, params?.keyword, params?.limit || 20);
    if (!res.ok) {
      return { ok: false, state: "error", message: res.message };
    }

    const nodes = res.data.productOfferV2?.nodes || [];
    return { ok: true, data: nodes.map(normalizeShopeeNode) };
  },

  async listOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>> {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId || !secret) return notConfigured("Shopee");

    const res = await shopeeTopSellers({ appId, secret }, params?.limit || 20);
    if (!res.ok) {
      return { ok: false, state: "error", message: res.message };
    }

    const nodes = res.data.productOfferV2?.nodes || [];
    return { ok: true, data: nodes.map(normalizeShopeeNode) };
  },

  async getProduct(
    externalId: string,
    credentials: Record<string, string>,
  ): Promise<AdapterResult<NormalizedProduct>> {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId || !secret) return notConfigured("Shopee");

    const searchRes = await shopeeSearchProducts({ appId, secret }, externalId, 1);
    if (!searchRes.ok || !searchRes.data.productOfferV2?.nodes?.length) {
      return { ok: false, state: "error", message: "Produto não localizado na Shopee." };
    }

    return { ok: true, data: normalizeShopeeNode(searchRes.data.productOfferV2.nodes[0]!) };
  },

  async buildAffiliateLink(
    originalUrl: string,
    credentials: Record<string, string>,
    subId?: string,
  ): Promise<AdapterResult<string>> {
    const appId = credentials["api_key"]?.trim();
    const secret = credentials["api_secret"]?.trim();
    if (!appId || !secret) return notConfigured("Shopee");

    const res = await shopeeGenerateShortLink({ appId, secret }, originalUrl, subId);
    if (!res.ok) {
      return { ok: false, state: "error", message: res.message };
    }

    const shortLink = res.data.generateShortLink?.shortLink;
    if (!shortLink) {
      return { ok: false, state: "error", message: "Não foi possível gerar o link curto de afiliado." };
    }

    return { ok: true, data: shortLink };
  },

  async syncOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<{ products: NormalizedProduct[]; total: number }>> {
    const offersRes = await this.listOffers(credentials, params);
    if (!offersRes.ok) return offersRes;

    return {
      ok: true,
      data: {
        products: offersRes.data,
        total: offersRes.data.length,
      },
    };
  },
};
