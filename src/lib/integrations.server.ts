/**
 * Helpers server-only para configuração e sincronização de integrações.
 * As credenciais nunca voltam para o cliente: apenas a lista de chaves preenchidas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHANNEL_CONNECTORS, type ChannelPlatform } from "@/integrations/channels";
import { MARKETPLACE_ADAPTERS, type MarketplaceSlug } from "@/integrations/marketplaces";
import { computeOfferScore } from "@/lib/offer-score";
import { AffiliateLinkResolver } from "@/lib/affiliate/AffiliateLinkResolver";

export type IntegrationKind = "marketplace" | "channel";

export interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
}

export function fieldsFor(kind: IntegrationKind, provider: string): FieldDef[] {
  if (kind === "marketplace") {
    return MARKETPLACE_ADAPTERS[provider as MarketplaceSlug]?.credentialFields ?? [];
  }
  return CHANNEL_CONNECTORS[provider as ChannelPlatform]?.credentialFields ?? [];
}

export function providerName(kind: IntegrationKind, provider: string) {
  return kind === "marketplace"
    ? (MARKETPLACE_ADAPTERS[provider as MarketplaceSlug]?.name ?? provider)
    : (CHANNEL_CONNECTORS[provider as ChannelPlatform]?.name ?? provider);
}

export function isValidProvider(kind: IntegrationKind, provider: string) {
  return fieldsFor(kind, provider).length > 0;
}

/** Mescla o que veio do formulário com o que já estava salvo (campo vazio = manter). */
export function mergeCredentials(
  kind: IntegrationKind,
  provider: string,
  current: Record<string, string>,
  incoming: Record<string, string>,
) {
  const allowed = new Set(fieldsFor(kind, provider).map((f) => f.key));
  const next: Record<string, string> = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (!allowed.has(key)) continue;
    const clean = String(value ?? "").trim().slice(0, 4096);
    if (clean) next[key] = clean;
  }
  return next;
}

export function filledKeys(
  kind: IntegrationKind,
  provider: string,
  credentials: Record<string, string>,
) {
  return fieldsFor(kind, provider)
    .filter((f) => Boolean(credentials[f.key]))
    .map((f) => f.key);
}

export type TestOutcome = {
  status: "connected" | "pending" | "error";
  message: string;
};

async function testTelegram(creds: Record<string, string>): Promise<TestOutcome> {
  const token = creds["bot_token"];
  const chatId = creds["chat_id"];
  if (!token) return { status: "error", message: "Informe o Bot Token." };
  try {
    const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
    if (!me?.ok) {
      return { status: "error", message: "Bot Token inválido ou revogado." };
    }
    let chatTitle: string | undefined;
    if (chatId) {
      const chat = await fetch(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`,
      ).then((r) => r.json());
      if (!chat?.ok) {
        return {
          status: "error",
          message:
            "Bot válido, mas não consegui acessar o chat informado. Adicione o bot como administrador do grupo/canal.",
        };
      }
      chatTitle = chat.result?.title ?? chat.result?.username;
    }
    return {
      status: "connected",
      message: chatTitle
        ? `Conectado como @${me.result?.username} — destino: ${chatTitle}`
        : `Conectado como @${me.result?.username}`,
    };
  } catch {
    return { status: "error", message: "Falha ao contatar a API do Telegram." };
  }
}

async function testWhatsAppMeta(creds: Record<string, string>): Promise<TestOutcome> {
  const token = creds["access_token"];
  const phoneId = creds["phone_number_id"];
  if (!token || !phoneId) {
    return { status: "error", message: "Informe o Phone Number ID e o Access Token." };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json: Record<string, unknown> = await res.json();
    if (!res.ok) {
      const err = json["error"] as { message?: string } | undefined;
      return { status: "error", message: err?.message ?? "Credenciais recusadas pela Meta." };
    }
    return {
      status: "connected",
      message: `Conectado: ${String(json["verified_name"] ?? "")} (${String(json["display_phone_number"] ?? "")}).`,
    };
  } catch {
    return { status: "error", message: "Falha ao contatar a API da Meta." };
  }
}

/**
 * Valida de forma real as credenciais com o provedor correspondente.
 */
export async function runTest(
  kind: IntegrationKind,
  provider: string,
  creds: Record<string, string>,
): Promise<TestOutcome> {
  if (kind === "channel") {
    if (provider === "telegram") return testTelegram(creds);
    if (provider === "whatsapp") return testWhatsAppMeta(creds);
    return { status: "pending", message: "Canal salvo." };
  }

  const adapter = MARKETPLACE_ADAPTERS[provider as MarketplaceSlug];
  if (!adapter) {
    return { status: "error", message: "Marketplace desconhecido." };
  }

  // Executa validação oficial do adaptador
  const testRes = await adapter.testConnection(creds);

  if (!testRes.ok) {
    return {
      status: testRes.state === "not_configured" ? "pending" : "error",
      message: testRes.message,
    };
  }

  return {
    status: "connected",
    message: testRes.data.message || `Conexão com ${adapter.name} validada com sucesso!`,
  };
}

/**
 * Sincroniza ofertas REAIS do marketplace para o banco de dados e resolve os links de afiliados.
 * NUNCA injeta ofertas fictícias.
 */
export async function syncMarketplaceOffers(
  supabase: SupabaseClient,
  userId: string,
  marketplace: MarketplaceSlug,
): Promise<{ ok: boolean; message?: string; total?: number; imported?: number; at?: string }> {
  const adapter = MARKETPLACE_ADAPTERS[marketplace];
  if (!adapter) {
    return { ok: false, message: "Marketplace não suportado." };
  }

  // 1. Busca credenciais no banco
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: credRow } = await supabaseAdmin
    .from("integration_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("kind", "marketplace")
    .eq("provider", marketplace)
    .maybeSingle();

  const creds = (credRow?.credentials ?? {}) as Record<string, string>;

  // 2. Executa a sincronização real no marketplace
  const syncResult = await adapter.syncOffers(creds);

  if (!syncResult.ok) {
    await supabase
      .from("marketplace_connections")
      .upsert(
        {
          user_id: userId,
          marketplace,
          status: syncResult.state,
          last_error: syncResult.message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,marketplace" },
      );

    return { ok: false, message: syncResult.message };
  }

  const products = syncResult.data.products;
  const now = new Date().toISOString();
  let importedCount = 0;

  for (const p of products) {
    if (!p.title || p.price <= 0) continue;

    // A. Upsert no catálogo de produtos
    const { data: prodData } = await supabase
      .from("products")
      .upsert(
        {
          user_id: userId,
          marketplace,
          external_id: p.externalId || `ext_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: p.title,
          image_url: p.imageUrl,
          url: p.url,
          price: p.price,
          rating: p.rating,
          sales_count: p.salesCount,
          updated_at: now,
        },
        { onConflict: "user_id,marketplace,external_id" as any },
      )
      .select("id")
      .maybeSingle();

    const productId = prodData?.id;

    // B. Resolve o link de afiliado oficial usando o AffiliateLinkResolver
    let finalAffiliateUrl = p.affiliateUrl || p.url || "";
    if (p.url) {
      const resolved = await AffiliateLinkResolver.resolve(supabase, {
        userId,
        originalUrl: p.url,
        marketplace,
        productId,
        productTitle: p.title,
      });

      if (resolved.ok) {
        finalAffiliateUrl = resolved.affiliateUrl;
      }
    }

    // C. Calcula score da oferta
    const scoreResult = computeOfferScore({
      discountPct: p.discountPct,
      price: p.price,
      rating: p.rating,
      salesCount: p.salesCount,
      commissionPct: p.commissionPct,
      freeShipping: p.freeShipping,
      available: p.available,
    });

    // D. Upsert na tabela de ofertas
    const { data: offerData } = await supabase
      .from("offers")
      .upsert(
        {
          user_id: userId,
          product_id: productId || null,
          marketplace,
          title: p.title,
          image_url: p.imageUrl,
          price: p.price,
          previous_price: p.previousPrice,
          discount_pct: p.discountPct || 0,
          rating: p.rating,
          sales_count: p.salesCount,
          commission: p.commission,
          commission_pct: p.commissionPct,
          free_shipping: p.freeShipping || false,
          original_url: p.url,
          affiliate_url: finalAffiliateUrl,
          score: scoreResult.score,
          status: "new",
          updated_at: now,
        },
        { onConflict: "user_id,marketplace,title" as any },
      )
      .select("id")
      .maybeSingle();

    // E. Registra snapshot no histórico de preços
    if (productId || offerData?.id) {
      await supabase.from("offer_price_history").insert({
        user_id: userId,
        product_id: productId || null,
        offer_id: offerData?.id || null,
        marketplace,
        price: p.price,
        promo_price: p.price,
        original_price: p.previousPrice,
        coupon: p.coupon,
        free_shipping: p.freeShipping || false,
        available: p.available ?? true,
        captured_at: now,
      });
    }

    importedCount++;
  }

  // 3. Atualiza status da conexão para conectado com sucesso
  await supabase.from("marketplace_connections").upsert(
    {
      user_id: userId,
      marketplace,
      status: "connected",
      last_sync_at: now,
      last_error: null,
      updated_at: now,
    },
    { onConflict: "user_id,marketplace" },
  );

  // 4. Registra auditoria
  await supabase.from("audit_logs").insert({
    user_id: userId,
    channel: "marketplace_sync",
    action: `sync_${marketplace}`,
    entity: "offers",
    meta: { total: products.length, imported: importedCount, at: now },
  });

  return {
    ok: true,
    message: `${importedCount} ofertas reais sincronizadas da ${adapter.name}!`,
    total: products.length,
    imported: importedCount,
    at: now,
  };
}
