import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MarketplaceSyncEngine } from "./MarketplaceSyncEngine";

export const syncMarketplaceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        marketplace: z.enum(["shopee", "mercadolivre", "amazon", "shein"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return MarketplaceSyncEngine.sync(context.supabase, context.userId, data.marketplace);
  });

export const syncAllMarketplacesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const marketplaces: ("shopee" | "mercadolivre" | "amazon" | "shein")[] = [
      "shopee",
      "mercadolivre",
      "amazon",
      "shein",
    ];

    const results = [];
    for (const mkt of marketplaces) {
      // Executa de forma sequencial para respeitar limites de requisições / rate limits
      try {
        const res = await MarketplaceSyncEngine.sync(context.supabase, context.userId, mkt);
        results.push(res);
      } catch (err: any) {
        results.push({
          marketplace: mkt,
          ok: false,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          itemsFound: 0,
          itemsImported: 0,
          itemsUpdated: 0,
          itemsSkipped: 0,
          errorCount: 1,
          lastError: err.message || "Erro inesperado na fila.",
        });
      }
    }

    return results;
  });

export const updateAutoSyncIntervalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        marketplace: z.enum(["shopee", "mercadolivre", "amazon", "shein"]),
        interval: z.enum(["15min", "30min", "1hour", "3hours", "daily", "disabled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marketplace_connections")
      .upsert(
        {
          user_id: context.userId,
          marketplace: data.marketplace,
          auto_sync_interval: data.interval,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,marketplace" },
      );

    if (error) throw error;
    return { ok: true, message: `Intervalo atualizado para: ${data.interval}` };
  });

export const getLatestSyncLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("marketplace_sync_logs")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;
    return data || [];
  });
