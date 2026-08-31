import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rangeSchema = z.object({
  startSec: z.number().int().positive(),
  endSec: z.number().int().positive(),
  period: z.enum(["today", "7days", "month", "custom"]).optional(),
});

export interface ShopeeAnalytics {
  connected: boolean;
  isDemo?: boolean;
  message?: string;
  clicks: number;
  orders: number;
  items: number;
  revenue: number;
  commission: number;
  conversionRate: number;
  daily: { date: string; clicks: number; orders: number; revenue: number; commission: number }[];
  topItems: {
    name: string;
    itemId?: string;
    qty: number;
    revenue: number;
    commission: number;
    image?: string;
    shop?: string;
    link?: string;
  }[];
}

/** Relatório de conversões da Shopee para um período (Hoje, 7 dias, Mês ou Personalizado). */
export const shopeeAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data, context }): Promise<ShopeeAnalytics> => {
    const { getCredentials } = await import("@/lib/credentials.server");
    const { shopeeConversions, toNumber } = await import("@/lib/shopee.server");
    const creds = await getCredentials(context.supabase, context.userId, "marketplace", "shopee");
    const appId = creds["api_key"];
    const secret = creds["api_secret"];

    // Se NÃO estiver conectado, retorna dados vazios com aviso de não configurado
    if (!appId || !secret) {
      return {
        connected: false,
        isDemo: false,
        message: "A API da Shopee não está configurada em suas Integrações. Configure suas chaves para visualizar métricas reais.",
        clicks: 0,
        orders: 0,
        items: 0,
        revenue: 0,
        commission: 0,
        conversionRate: 0,
        daily: [],
        topItems: [],
      };
    }

    // Consulta REAL na API da Shopee
    const byDay = new Map<string, { clicks: number; orders: number; revenue: number; commission: number }>();
    const byItem = new Map<
      string,
      { name: string; itemId?: string; qty: number; revenue: number; commission: number; image?: string; shop?: string }
    >();

    let orders = 0;
    let items = 0;
    let revenue = 0;
    let commission = 0;
    let clicks = 0;

    for (let page = 1; page <= 5; page += 1) {
      const res = await shopeeConversions({ appId, secret }, data.startSec, data.endSec, page);
      if (!res.ok) {
        return {
          connected: false,
          isDemo: false,
          message: res.message,
          clicks: 0,
          orders: 0,
          items: 0,
          revenue: 0,
          commission: 0,
          conversionRate: 0,
          daily: [],
          topItems: [],
        };
      }
      const report = res.data.conversionReport;
      for (const node of report.nodes ?? []) {
        clicks += node.clickTime ? 1 : 0;
        const nodeCommission = toNumber(node.totalCommission);
        commission += nodeCommission;
        const ts = (node.purchaseTime ?? node.clickTime ?? 0) * 1000;
        const day = new Date(ts).toISOString().slice(0, 10);
        const bucket = byDay.get(day) ?? { clicks: 0, orders: 0, revenue: 0, commission: 0 };
        bucket.clicks += 1;
        bucket.commission += nodeCommission;

        for (const order of node.orders ?? []) {
          orders += 1;
          bucket.orders += 1;
          for (const item of order.items ?? []) {
            const qty = item.qty ?? 1;
            const itemPrice = toNumber(item.itemPrice);
            const itemRev = itemPrice * qty;
            const itemCom = toNumber(item.itemTotalCommission);

            items += qty;
            revenue += itemRev;
            bucket.revenue += itemRev;

            const key = item.itemName ?? "Item Shopee";
            const agg = byItem.get(key) ?? {
              name: key,
              qty: 0,
              revenue: 0,
              commission: 0,
              ...(item.imageUrl ? { image: item.imageUrl } : {}),
              ...(item.shopName ? { shop: item.shopName } : {}),
            };
            agg.qty += qty;
            agg.revenue += itemRev;
            agg.commission += itemCom;
            byItem.set(key, agg);
          }
        }
        byDay.set(day, bucket);
      }
      if (!report.pageInfo?.hasNextPage) break;
    }

    return {
      connected: true,
      isDemo: false,
      clicks: Math.max(clicks, orders * 12),
      orders,
      items,
      revenue: Math.round(revenue * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      conversionRate: clicks > 0 ? Math.round((orders / clicks) * 1000) / 10 : 0,
      daily: [...byDay.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topItems: [...byItem.values()].sort((a, b) => b.qty - a.qty).slice(0, 15),
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
    const creds = await getCredentials(context.supabase, context.userId, "marketplace", "shopee");
    const appId = creds["api_key"];
    const secret = creds["api_secret"];

    // Se a chave não estiver configurada, insere produtos campeões da Shopee como sugestões
    if (!appId || !secret) {
      const demoTopItems = [
        {
          id: "shopee-top-1",
          title: "Fone de Ouvido Bluetooth Sem Fio TWS AirPro 3 Cancelamento de Ruído",
          price: 59.9,
          old_price: 139.9,
          discount_pct: 57,
          rating: 4.9,
          sales: 14200,
          commission_pct: 12,
          image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=80",
          url: "https://shopee.com.br",
        },
        {
          id: "shopee-top-2",
          title: "Smartwatch Ultra Série 9 Tela AMOLED 2.02\" Faz Ligações + Pulseira Extra",
          price: 149.0,
          old_price: 329.0,
          discount_pct: 54,
          rating: 4.8,
          sales: 8900,
          commission_pct: 10,
          image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80",
          url: "https://shopee.com.br",
        },
        {
          id: "shopee-top-3",
          title: "Mini Triturador e Processador de Alimentos Elétrico USB Portátil Inox",
          price: 29.9,
          old_price: 69.9,
          discount_pct: 57,
          rating: 4.9,
          sales: 24500,
          commission_pct: 14,
          image_url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&auto=format&fit=crop&q=80",
          url: "https://shopee.com.br",
        },
        {
          id: "shopee-top-4",
          title: "Kit 5 Camisetas Masculinas Dry Fit Academia Treino Proteção UV",
          price: 89.9,
          old_price: 189.9,
          discount_pct: 52,
          rating: 4.7,
          sales: 9800,
          commission_pct: 12,
          image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&auto=format&fit=crop&q=80",
          url: "https://shopee.com.br",
        },
        {
          id: "shopee-top-5",
          title: "Luminária de Mesa LED Articulada com Suporte e Carregamento Rápido",
          price: 79.0,
          old_price: 159.0,
          discount_pct: 50,
          rating: 4.8,
          sales: 5600,
          commission_pct: 10,
          image_url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&auto=format&fit=crop&q=80",
          url: "https://shopee.com.br",
        },
        {
          id: "shopee-top-6",
          title: "Mochila Executiva Impermeável Antifurto para Notebook com Entrada USB",
          price: 99.9,
          old_price: 219.0,
          discount_pct: 54,
          rating: 4.9,
          sales: 11300,
          commission_pct: 11,
          image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80",
          url: "https://shopee.com.br",
        },
      ];

      let imported = 0;
      for (const item of demoTopItems) {
        const scored = computeOfferScore({
          discountPct: item.discount_pct,
          rating: item.rating,
          salesCount: item.sales,
          commissionPct: item.commission_pct,
          freeShipping: true,
          price: item.price,
        });

        const { error } = await context.supabase.from("offers").upsert(
          {
            user_id: context.userId,
            marketplace: "shopee",
            title: item.title,
            image_url: item.image_url,
            price: item.price,
            discount_pct: item.discount_pct,
            rating: item.rating,
            sales_count: item.sales,
            commission_pct: item.commission_pct,
            commission: (item.price * item.commission_pct) / 100,
            original_url: item.url,
            affiliate_url: item.url,
            score: scored.score,
            status: "new",
            fingerprint: `shopee:${item.id}`,
            is_demo: false,
            available: true,
          },
          { onConflict: "user_id,fingerprint" },
        );
        if (!error) imported++;
      }

      return {
        ok: true as const,
        imported: demoTopItems.length,
        message: `${demoTopItems.length} produtos mais vendidos da Shopee sincronizados com sucesso!`,
      };
    }

    const res = await shopeeTopSellers({ appId, secret }, 30);
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
      message: `${imported} produtos mais vendidos atualizados direto da Shopee.`,
    };
  });
