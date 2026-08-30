import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rangeSchema = z.object({
  startSec: z.number().int().positive(),
  endSec: z.number().int().positive(),
});

export interface ShopeeAnalytics {
  connected: boolean;
  message?: string;
  clicks: number;
  orders: number;
  items: number;
  revenue: number;
  commission: number;
  daily: { date: string; orders: number; commission: number }[];
  topItems: { name: string; qty: number; commission: number; image?: string; shop?: string }[];
}

/** Relatório de conversões da Shopee para um período. */
export const shopeeAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data, context }): Promise<ShopeeAnalytics> => {
    const empty: ShopeeAnalytics = {
      connected: false,
      clicks: 0,
      orders: 0,
      items: 0,
      revenue: 0,
      commission: 0,
      daily: [],
      topItems: [],
    };
    const { getCredentials } = await import("@/lib/credentials.server");
    const { shopeeConversions, toNumber } = await import("@/lib/shopee.server");
    const creds = await getCredentials(context.userId, "marketplace", "shopee");
    const appId = creds["api_key"];
    const secret = creds["api_secret"];
    if (!appId || !secret) {
      return { ...empty, message: "Conecte a Shopee em Integrações (App ID + Senha da API)." };
    }

    const byDay = new Map<string, { orders: number; commission: number }>();
    const byItem = new Map<
      string,
      { name: string; qty: number; commission: number; image?: string; shop?: string }
    >();
    let orders = 0;
    let items = 0;
    let revenue = 0;
    let commission = 0;
    let clicks = 0;

    for (let page = 1; page <= 5; page += 1) {
      const res = await shopeeConversions({ appId, secret }, data.startSec, data.endSec, page);
      if (!res.ok) return { ...empty, message: res.message };
      const report = res.data.conversionReport;
      for (const node of report.nodes ?? []) {
        clicks += node.clickTime ? 1 : 0;
        const nodeCommission = toNumber(node.totalCommission);
        commission += nodeCommission;
        const ts = (node.purchaseTime ?? node.clickTime ?? 0) * 1000;
        const day = new Date(ts).toISOString().slice(0, 10);
        const bucket = byDay.get(day) ?? { orders: 0, commission: 0 };
        bucket.commission += nodeCommission;
        for (const order of node.orders ?? []) {
          orders += 1;
          bucket.orders += 1;
          for (const item of order.items ?? []) {
            const qty = item.qty ?? 1;
            items += qty;
            revenue += toNumber(item.itemPrice) * qty;
            const key = item.itemName ?? "Item";
            const agg = byItem.get(key) ?? {
              name: key,
              qty: 0,
              commission: 0,
              ...(item.imageUrl ? { image: item.imageUrl } : {}),
              ...(item.shopName ? { shop: item.shopName } : {}),
            };
            agg.qty += qty;
            agg.commission += toNumber(item.itemTotalCommission);
            byItem.set(key, agg);
          }
        }
        byDay.set(day, bucket);
      }
      if (!report.pageInfo?.hasNextPage) break;
    }

    return {
      connected: true,
      clicks,
      orders,
      items,
      revenue,
      commission,
      daily: [...byDay.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topItems: [...byItem.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
    };
  });

/**
 * Levantamento dos produtos mais vendidos da Shopee e gravação como sugestões
 * de oferta (tabela `offers`, status `new`). Mantém a lista atualizada.
 */
export const refreshTopSellers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCredentials } = await import("@/lib/credentials.server");
    const { shopeeTopSellers, toNumber } = await import("@/lib/shopee.server");
    const { computeOfferScore } = await import("@/lib/offer-score");
    const creds = await getCredentials(context.userId, "marketplace", "shopee");
    const appId = creds["api_key"];
    const secret = creds["api_secret"];
    if (!appId || !secret) {
      return { ok: false as const, imported: 0, message: "Conecte a Shopee em Integrações." };
    }

    const res = await shopeeTopSellers({ appId, secret }, 20);
    if (!res.ok) return { ok: false as const, imported: 0, message: res.message };

    const nodes = res.data.productOfferV2?.nodes ?? [];
    let imported = 0;
    for (const node of nodes) {
      const price = toNumber(node.price ?? node.priceMin);
      const discountPct = Math.round(toNumber(node.priceDiscountRate));
      const rating = toNumber(node.ratingStar);
      const sales = node.sales ?? 0;
      const commissionPct = toNumber(node.commissionRate) * (toNumber(node.commissionRate) <= 1 ? 100 : 1);
      const fingerprint = `shopee:${node.itemId}`;
      const scored = computeOfferScore({
        discountPct,
        rating,
        salesCount: sales,
        commissionPct,
        freeShipping: false,
        price,
      });

      const { error } = await context.supabase.from("offers").upsert(
        {
          user_id: context.userId,
          marketplace: "shopee",
          title: node.productName ?? "Produto Shopee",
          image_url: node.imageUrl ?? null,
          price,
          discount_pct: discountPct,
          rating: rating || null,
          sales_count: sales,
          commission_pct: commissionPct || null,
          commission: price ? (price * commissionPct) / 100 : null,
          original_url: node.productLink ?? null,
          affiliate_url: node.offerLink ?? null,
          score: scored.score,
          status: "new",
          fingerprint,
          is_demo: false,
          available: true,
        },
        { onConflict: "user_id,fingerprint" },
      );
      if (!error) imported += 1;
    }

    return {
      ok: true as const,
      imported,
      message: `${imported} produtos mais vendidos atualizados.`,
    };
  });
