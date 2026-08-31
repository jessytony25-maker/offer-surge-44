import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  filledKeys,
  isValidProvider,
  mergeCredentials,
  runTest,
  type IntegrationKind,
} from "@/lib/integrations.server";
import { MARKETPLACE_ADAPTERS, type MarketplaceSlug } from "@/integrations/marketplaces";
import { MarketplaceSyncEngine } from "@/lib/sync/MarketplaceSyncEngine";

const targetSchema = z.object({
  kind: z.enum(["marketplace", "channel"]),
  provider: z.string().min(1).max(40),
});

const saveSchema = targetSchema.extend({
  credentials: z.record(z.string(), z.string().max(4096)),
});

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: creds }, marketplaces, channels] = await Promise.all([
      context.supabase
        .from("integration_credentials")
        .select("kind, provider, credentials")
        .eq("user_id", context.userId),
      context.supabase
        .from("marketplace_connections")
        .select("marketplace, status, last_error, last_sync_at, auto_sync_interval"),
      context.supabase
        .from("channel_connections")
        .select("platform, status, last_error, last_test_at"),
    ]);

    const keysFor = (kind: IntegrationKind, provider: string) => {
      const row = (creds ?? []).find((c) => c.kind === kind && c.provider === provider);
      return filledKeys(kind, provider, (row?.credentials ?? {}) as Record<string, string>);
    };

    return {
      marketplaces: (marketplaces.data ?? []).map((m) => ({
        provider: m.marketplace,
        status: m.status,
        lastError: m.last_error,
        lastEventAt: m.last_sync_at,
        autoSyncInterval: (m as any).auto_sync_interval || "disabled",
        filledKeys: keysFor("marketplace", m.marketplace),
      })),
      channels: (channels.data ?? []).map((c) => ({
        provider: c.platform as string,
        status: c.status,
        lastError: c.last_error,
        lastEventAt: c.last_test_at,
        filledKeys: keysFor("channel", c.platform as string),
      })),
    };
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const kind = data.kind as IntegrationKind;
    if (!isValidProvider(kind, data.provider)) throw new Error("Integração desconhecida");

    const { data: existing } = await context.supabase
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", kind)
      .eq("provider", data.provider)
      .maybeSingle();

    const merged = mergeCredentials(
      kind,
      data.provider,
      (existing?.credentials ?? {}) as Record<string, string>,
      data.credentials,
    );

    await context.supabase.from("integration_credentials").upsert(
      { user_id: context.userId, kind, provider: data.provider, credentials: merged },
      { onConflict: "user_id,kind,provider" },
    );

    const result = await runTest(kind, data.provider, merged);

    if (kind === "channel") {
      await context.supabase.from("channel_connections").upsert(
        {
          user_id: context.userId,
          platform: data.provider as "whatsapp" | "telegram" | "other",
          status: result.status,
          last_error: result.status === "error" ? result.message : null,
          last_test_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform" },
      );
    } else {
      await context.supabase.from("marketplace_connections").upsert(
        {
          user_id: context.userId,
          marketplace: data.provider,
          status: result.status,
          last_error: result.status === "error" ? result.message : null,
        },
        { onConflict: "user_id,marketplace" },
      );
    }

    return {
      status: result.status,
      message: result.message,
      filledKeys: filledKeys(kind, data.provider, merged),
    };
  });

export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => targetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const kind = data.kind as IntegrationKind;
    await context.supabase
      .from("integration_credentials")
      .delete()
      .eq("user_id", context.userId)
      .eq("kind", kind)
      .eq("provider", data.provider);

    if (kind === "channel") {
      await context.supabase
        .from("channel_connections")
        .delete()
        .eq("platform", data.provider as "whatsapp" | "telegram" | "other");
    } else {
      await context.supabase
        .from("marketplace_connections")
        .delete()
        .eq("marketplace", data.provider);
    }
    return { ok: true };
  });

/**
 * Dispara a sincronização real de ofertas de um marketplace utilizando a sync engine robusta.
 */
export const syncMarketplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { marketplace: string }) =>
    z.object({ marketplace: z.enum(["shopee", "mercadolivre", "amazon", "shein"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const res = await MarketplaceSyncEngine.sync(
      context.supabase,
      context.userId,
      data.marketplace as MarketplaceSlug,
    );
    return {
      ok: res.ok,
      message: res.lastError || `Sincronização concluída com sucesso para ${data.marketplace}!`,
      imported: res.itemsImported,
      total: res.itemsFound,
      skipped: res.itemsSkipped,
      updated: res.itemsUpdated,
    };
  });

/**
 * Converte um link original em link de afiliado usando as credenciais do usuário.
 */
export const buildAffiliateLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { originalUrl: string; subId?: string }) =>
    z
      .object({
        originalUrl: z.string().url("URL inválida"),
        subId: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { originalUrl, subId } = data;
    // Identifica o marketplace da URL
    let foundSlug: MarketplaceSlug | null = null;
    for (const [slug, adapter] of Object.entries(MARKETPLACE_ADAPTERS)) {
      if (adapter.matchesUrl(originalUrl)) {
        foundSlug = slug as MarketplaceSlug;
        break;
      }
    }

    if (!foundSlug) {
      return { ok: false, error: "Marketplace da URL não identificado." };
    }

    const adapter = MARKETPLACE_ADAPTERS[foundSlug];
    const { data: credRow } = await context.supabase
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", foundSlug)
      .maybeSingle();

    const creds = (credRow?.credentials ?? {}) as Record<string, string>;
    const res = await adapter.buildAffiliateLink(originalUrl, creds, subId);

    if (!res.ok) {
      return { ok: false, error: res.message };
    }

    return { ok: true, affiliateUrl: res.data, marketplace: foundSlug };
  });
