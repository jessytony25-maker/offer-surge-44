/**
 * Cliente server-only da Shopee Affiliate Open API (GraphQL assinado).
 *
 * Autenticação oficial:
 *   Authorization: SHA256 Credential=<AppId>, Timestamp=<ts>, Signature=<sha256(AppId+ts+payload+Secret)>
 */

const SHOPEE_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ShopeeCreds {
  appId: string;
  secret: string;
}

export type ShopeeCall<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export async function shopeeGraphql<T>(
  creds: ShopeeCreds,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<ShopeeCall<T>> {
  const payload = JSON.stringify({ query, variables });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha256Hex(`${creds.appId}${timestamp}${payload}${creds.secret}`);

  try {
    const res = await fetch(SHOPEE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${creds.appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
    });
    const json = (await res.json()) as {
      data?: T;
      errors?: { message?: string; extensions?: { message?: string } }[];
    };
    if (!res.ok) {
      return { ok: false, message: `Shopee respondeu HTTP ${res.status}.` };
    }
    if (json.errors?.length) {
      const first = json.errors[0];
      return {
        ok: false,
        message: first?.extensions?.message ?? first?.message ?? "Requisição recusada pela Shopee.",
      };
    }
    if (!json.data) return { ok: false, message: "Resposta vazia da Shopee." };
    return { ok: true, data: json.data };
  } catch (err: any) {
    return { ok: false, message: `Falha ao contatar a API da Shopee: ${err.message || "Erro de rede"}` };
  }
}

export interface ShopeeOfferNode {
  itemId?: string | number;
  productName?: string;
  imageUrl?: string;
  offerLink?: string;
  productLink?: string;
  price?: string;
  priceMin?: string;
  priceMax?: string;
  sales?: number;
  ratingStar?: string;
  commissionRate?: string;
  commission?: string;
  shopName?: string;
  productCatIds?: number[];
  priceDiscountRate?: number;
}

const TOP_PRODUCTS_QUERY = `
query topProducts($limit: Int) {
  productOfferV2(listType: 0, sortType: 2, limit: $limit) {
    nodes {
      itemId
      productName
      imageUrl
      offerLink
      productLink
      price
      priceMin
      priceMax
      sales
      ratingStar
      commissionRate
      commission
      shopName
      priceDiscountRate
    }
  }
}`;

export async function shopeeTopSellers(creds: ShopeeCreds, limit = 20) {
  return shopeeGraphql<{ productOfferV2: { nodes: ShopeeOfferNode[] } }>(
    creds,
    TOP_PRODUCTS_QUERY,
    { limit },
  );
}

const SEARCH_PRODUCTS_QUERY = `
query searchProducts($keyword: String, $page: Int, $limit: Int) {
  productOfferV2(keyword: $keyword, page: $page, limit: $limit, sortType: 2) {
    nodes {
      itemId
      productName
      imageUrl
      offerLink
      productLink
      price
      priceMin
      priceMax
      sales
      ratingStar
      commissionRate
      commission
      shopName
      priceDiscountRate
    }
  }
}`;

export async function shopeeSearchProducts(creds: ShopeeCreds, keyword?: string, limit = 20) {
  return shopeeGraphql<{ productOfferV2: { nodes: ShopeeOfferNode[] } }>(
    creds,
    SEARCH_PRODUCTS_QUERY,
    { keyword: keyword || "", limit, page: 1 },
  );
}

const GENERATE_SHORT_LINK_MUTATION = `
mutation generateShortLink($originUrl: String!, $subIds: [String]) {
  generateShortLink(input: { originUrl: $originUrl, subIds: $subIds }) {
    shortLink
  }
}`;

export async function shopeeGenerateShortLink(creds: ShopeeCreds, originUrl: string, subId?: string) {
  return shopeeGraphql<{ generateShortLink: { shortLink: string } }>(
    creds,
    GENERATE_SHORT_LINK_MUTATION,
    { originUrl, subIds: subId ? [subId] : [] },
  );
}

export interface ShopeeConversionNode {
  purchaseTime?: number;
  clickTime?: number;
  conversionId?: string | number;
  orders?: {
    orderId?: string | number;
    items?: {
      itemName?: string;
      itemPrice?: string;
      qty?: number;
      itemTotalCommission?: string;
      imageUrl?: string;
      shopName?: string;
    }[];
  }[];
  totalCommission?: string;
}

const CONVERSION_QUERY = `
query conversions($start: Int!, $end: Int!, $page: Int!) {
  conversionReport(purchaseTimeStart: $start, purchaseTimeEnd: $end, limit: 100, page: $page) {
    nodes {
      conversionId
      purchaseTime
      clickTime
      totalCommission
      orders {
        orderId
        items {
          itemName
          itemPrice
          qty
          itemTotalCommission
          imageUrl
          shopName
        }
      }
    }
    pageInfo { hasNextPage page limit }
  }
}`;

export async function shopeeConversions(
  creds: ShopeeCreds,
  startSec: number,
  endSec: number,
  page = 1,
) {
  return shopeeGraphql<{
    conversionReport: {
      nodes: ShopeeConversionNode[];
      pageInfo?: { hasNextPage?: boolean; page?: number };
    };
  }>(creds, CONVERSION_QUERY, { start: startSec, end: endSec, page });
}

/** Teste de conexão: consulta 1 oferta na API. */
export async function shopeeTestConnection(creds: ShopeeCreds) {
  return shopeeGraphql<{ productOfferV2: { nodes: ShopeeOfferNode[] } }>(
    creds,
    `query ping { productOfferV2(limit: 1) { nodes { itemId productName } } }`,
  );
}

export function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
