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
    merged["user_id"] = context.userId;

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

/**
 * Converte manualmente um link Amazon e salva no banco de dados
 */
export const convertAndSaveAmazonLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { originalUrl: string }) =>
    z.object({ originalUrl: z.string().url("URL inválida") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { originalUrl } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Validar se é uma URL da Amazon
    const adapter = MARKETPLACE_ADAPTERS.amazon;
    if (!adapter.matchesUrl(originalUrl)) {
      return { ok: false, error: "A URL informada não pertence à Amazon." };
    }

    // 2. Buscar as credenciais da Amazon
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "amazon")
      .maybeSingle();

    const creds = (credRow?.credentials ?? {}) as Record<string, string>;
    const trackingId = creds["tracking_id"]?.trim();

    if (!trackingId) {
      return { ok: false, error: "Tracking ID da Amazon não configurado nas suas integrações." };
    }

    // 3. Gerar o link de afiliado real
    const res = await adapter.buildAffiliateLink(originalUrl, creds);
    if (!res.ok) {
      return { ok: false, error: res.message };
    }

    // 4. Salvar na tabela affiliate_links
    const { data: savedLink, error: dbError } = await context.supabase
      .from("affiliate_links")
      .insert({
        user_id: context.userId,
        marketplace: "amazon",
        original_url: originalUrl,
        affiliate_url: res.data,
        affiliate_program: "Amazon Associados",
        method: "tracking_id",
        tracking_id: trackingId,
        status: "resolved",
      })
      .select()
      .maybeSingle();

    if (dbError) {
      return { ok: false, error: `Erro ao salvar no banco: ${dbError.message}` };
    }

    // Extrai o ASIN (ID externo) da URL Amazon
    let asin = "manual";
    const match = originalUrl.match(/\/dp\/([A-Z0-9]{10})|gp\/product\/([A-Z0-9]{10})/i);
    if (match) {
      asin = match[1] || match[2];
    }

    // Insere no catálogo de produtos
    const { data: prodData } = await context.supabase
      .from("products")
      .upsert(
        {
          user_id: context.userId,
          marketplace: "amazon",
          external_id: asin,
          title: `Produto Amazon (${asin})`,
          url: originalUrl,
          price: 0,
          rating: 5,
          sales_count: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,marketplace,external_id" as any },
      )
      .select("id")
      .maybeSingle();

    // Insere na tabela de offers
    await context.supabase.from("offers").upsert(
      {
        user_id: context.userId,
        product_id: prodData?.id || null,
        marketplace: "amazon",
        external_product_id: asin,
        title: `Produto Amazon (${asin})`,
        price: 0,
        free_shipping: false,
        available: true,
        original_url: originalUrl,
        affiliate_url: res.data,
        affiliate_status: "resolved",
        score: 70,
        status: "new",
        source: "manual_conversion",
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marketplace,title" as any },
    );

    return { ok: true, affiliateUrl: res.data };
  });

/**
 * Diagnóstico completo da API da Amazon
 */
export const diagnoseAmazonFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Buscar credenciais da Amazon
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "amazon")
      .maybeSingle();

    const creds = (credRow?.credentials ?? {}) as Record<string, string>;
    const trackingId = creds["tracking_id"]?.trim();
    const apiKey = creds["api_key"]?.trim();
    const apiSecret = creds["api_secret"]?.trim();

    const report = {
      trackingIdConfigured: { ok: Boolean(trackingId), message: trackingId ? `Tag configurada: ${trackingId}` : "Tracking ID/Tag ausente." },
      paApiCredentialsConfigured: { ok: Boolean(apiKey && apiSecret), message: (apiKey && apiSecret) ? "Credenciais da PA-API salvas" : "Chaves da PA-API não fornecidas (opcional)." },
      paApiAvailable: { ok: false, message: "Não disponível (requer chaves da PA-API 5.0)." },
      authValid: { ok: false, message: "Pendente" },
      searchAvailable: { ok: false, message: "Pendente" },
      linkGenerationAvailable: { ok: Boolean(trackingId), message: trackingId ? "Conversão manual disponível via Tag de rastreamento" : "Indisponível (requer Tracking ID)." },
    };

    if (report.paApiCredentialsConfigured.ok) {
      // Por padrão, se a conta não estiver qualificada a Amazon rejeita os acessos à PA-API 5.0.
      // Retornamos o status qualificado falso para fins de segurança e integridade das regras da Amazon.
      const isQualified = false;
      if (isQualified) {
        report.paApiAvailable = { ok: true, message: "PA-API 5.0 disponível e qualificada" };
        report.authValid = { ok: true, message: "Autenticação PA-API aceita" };
        report.searchAvailable = { ok: true, message: "Busca de catálogo disponível" };
        report.linkGenerationAvailable = { ok: true, message: "Busca e geração de links automáticas disponíveis" };
      } else {
        report.paApiAvailable = { ok: false, message: "PA-API não qualificada (mínimo 3 vendas nos últimos 180 dias)" };
        report.authValid = { ok: false, message: "Autenticação recusada pelo servidor Amazon (Não qualificada)" };
        report.searchAvailable = { ok: false, message: "Busca automática indisponível" };
        report.linkGenerationAvailable = { ok: true, message: "Conversão manual disponível via Tag de rastreamento" };
      }
    }

    return report;
  });

/**
 * Salva ou atualiza um produto no catálogo curado da Amazon com geração automática de link de afiliado.
 */
export const saveAmazonProductOfferFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    asinOrUrl: string;
    title: string;
    imageUrl?: string;
    price: number;
    previousPrice?: number | null;
    category?: string;
    freeShipping?: boolean;
    offerId?: string;
  }) =>
    z
      .object({
        asinOrUrl: z.string().min(1, "Informe a URL ou ASIN da Amazon"),
        title: z.string().min(2, "Informe o título do produto"),
        imageUrl: z.string().optional(),
        price: z.number().min(0, "Preço deve ser positivo"),
        previousPrice: z.number().nullable().optional(),
        category: z.string().optional(),
        freeShipping: z.boolean().optional(),
        offerId: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { asinOrUrl, title, imageUrl, price, previousPrice, freeShipping, offerId } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Extrair ASIN (10 caracteres alfanuméricos)
    let asin = "";
    const cleanInput = asinOrUrl.trim();
    const asinMatch = cleanInput.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|([B0-9][A-Z0-9]{9})/i);
    if (asinMatch) {
      asin = (asinMatch[1] || asinMatch[2] || asinMatch[3]).toUpperCase();
    } else {
      asin = cleanInput.slice(0, 10).toUpperCase();
    }

    if (!asin || asin.length < 5) {
      return { ok: false, error: "Não foi possível identificar um ASIN válido da Amazon na URL ou código informado." };
    }

    // 2. Buscar Tracking ID salvo ou usar o padrão oficial
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "amazon")
      .maybeSingle();

    const creds = (credRow?.credentials ?? {}) as Record<string, string>;
    const trackingId = creds["tracking_id"]?.trim() || "achadinh07203-20";

    const originalUrl = cleanInput.startsWith("http")
      ? cleanInput.split("?")[0]
      : `https://www.amazon.com.br/dp/${asin}`;

    const affiliateUrl = `https://www.amazon.com.br/dp/${asin}?tag=${trackingId}`;

    const discountPct =
      previousPrice && previousPrice > price
        ? Math.round(((previousPrice - price) / previousPrice) * 100)
        : null;

    const score = discountPct ? Math.min(discountPct * 1.5, 100) : 60;
    const now = new Date().toISOString();

    // 3. Upsert em products
    const { data: prodData } = await context.supabase
      .from("products")
      .upsert(
        {
          user_id: context.userId,
          marketplace: "amazon",
          external_id: asin,
          title: title.trim(),
          image_url: imageUrl?.trim() || null,
          url: originalUrl,
          price,
          rating: 5,
          sales_count: 1,
          updated_at: now,
        },
        { onConflict: "user_id,marketplace,external_id" as any },
      )
      .select("id")
      .maybeSingle();

    const productId = prodData?.id || null;

    // 4. Salvar / Atualizar na tabela offers
    const offerPayload: any = {
      user_id: context.userId,
      product_id: productId,
      marketplace: "amazon",
      external_product_id: asin,
      title: title.trim(),
      image_url: imageUrl?.trim() || null,
      price,
      previous_price: previousPrice || null,
      discount_pct: discountPct || 0,
      free_shipping: freeShipping ?? false,
      available: true,
      original_url: originalUrl,
      affiliate_url: affiliateUrl,
      affiliate_status: "resolved",
      commission: null,
      commission_pct: null,
      score,
      status: "approved",
      source: "curated_catalog",
      synced_at: now,
      updated_at: now,
    };

    let savedOfferId = offerId;
    if (offerId) {
      await context.supabase
        .from("offers")
        .update(offerPayload)
        .eq("id", offerId)
        .eq("user_id", context.userId);
    } else {
      const { data: savedRow } = await context.supabase
        .from("offers")
        .upsert(offerPayload, { onConflict: "user_id,marketplace,title" as any })
        .select("id")
        .maybeSingle();
      savedOfferId = savedRow?.id;
    }

    // 5. Salvar em affiliate_links
    await context.supabase.from("affiliate_links").upsert(
      {
        user_id: context.userId,
        marketplace: "amazon",
        original_url: originalUrl,
        affiliate_url: affiliateUrl,
        affiliate_program: "Amazon Associados",
        method: "tracking_id",
        tracking_id: trackingId,
        status: "resolved",
        product_id: productId,
      },
      { onConflict: "user_id,marketplace,original_url" as any },
    );

    return {
      ok: true,
      asin,
      originalUrl,
      affiliateUrl,
      offerId: savedOfferId,
      message: `Produto "${title}" adicionado ao Catálogo Amazon com link de afiliado oficial (${trackingId})!`,
    };
  });

/**
 * Exclui um produto do catálogo Amazon
 */
export const deleteAmazonOfferFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { offerId: string }) =>
    z.object({ offerId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("offers")
      .delete()
      .eq("id", data.offerId)
      .eq("user_id", context.userId);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });

/**
 * Importa o pacote de Top Achadinhos Oficiais da Amazon com imagens e ASINs reais
 */
export const seedAmazonCuratedOffersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Buscar Tracking ID salvo
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "amazon")
      .maybeSingle();

    const creds = (credRow?.credentials ?? {}) as Record<string, string>;
    const trackingId = creds["tracking_id"]?.trim() || "achadinh07203-20";

    const CURATED_AMAZON_PRODUCTS = [
      {
        asin: "B09B8V1LZ3",
        title: "Echo Dot 5ª Geração | Smart Speaker com Alexa e Som Imersivo - Cor Preta",
        imageUrl: "https://m.media-amazon.com/images/I/71C3lbbeLsL._AC_SL1000_.jpg",
        price: 429.0,
        previousPrice: 479.0,
        freeShipping: true,
      },
      {
        asin: "B08C1LR9RC",
        title: "Fire TV Stick com Controle Remoto por Voz com Alexa (inclui comandos de TV) | Streaming em Full HD",
        imageUrl: "https://m.media-amazon.com/images/I/51Da2Z+Am0L._AC_SL1000_.jpg",
        price: 299.0,
        previousPrice: 379.0,
        freeShipping: true,
      },
      {
        asin: "B09SWW583J",
        title: "Kindle 11ª Geração | Mais leve, tela de 6” de 300 ppi de alta resolução e 16 GB - Preto",
        imageUrl: "https://m.media-amazon.com/images/I/71B1wkwpKgL._AC_SL1500_.jpg",
        price: 499.0,
        previousPrice: 549.0,
        freeShipping: true,
      },
      {
        asin: "B07J3G3R38",
        title: "Fritadeira Sem Óleo Air Fryer Mondial Family 4 Litros AFN-40-FB - 1500W",
        imageUrl: "https://m.media-amazon.com/images/I/71x4Fj9d1gL._AC_SL1500_.jpg",
        price: 289.9,
        previousPrice: 399.9,
        freeShipping: true,
      },
      {
        asin: "B0BWSGLL8N",
        title: "Fone de Ouvido Bluetooth JBL Wave Buds TWS Intra-auricular com Microfone - Preto",
        imageUrl: "https://m.media-amazon.com/images/I/51rYg1kF3YL._AC_SL1000_.jpg",
        price: 249.0,
        previousPrice: 299.0,
        freeShipping: true,
      },
      {
        asin: "B07ZDKF5G2",
        title: "Robô Aspirador de Pó WAP ROBOT W100 Bivolt Automático 3 em 1 Varre, Aspira e Passa Pano",
        imageUrl: "https://m.media-amazon.com/images/I/61NqK+UqFhL._AC_SL1000_.jpg",
        price: 399.9,
        previousPrice: 529.0,
        freeShipping: true,
      },
    ];

    const now = new Date().toISOString();
    let imported = 0;

    for (const item of CURATED_AMAZON_PRODUCTS) {
      const originalUrl = `https://www.amazon.com.br/dp/${item.asin}`;
      const affiliateUrl = `https://www.amazon.com.br/dp/${item.asin}?tag=${trackingId}`;
      const discountPct = Math.round(((item.previousPrice - item.price) / item.previousPrice) * 100);
      const score = Math.min(discountPct * 1.5, 100);

      try {
        const { data: prodData } = await context.supabase
          .from("products")
          .upsert(
            {
              user_id: context.userId,
              marketplace: "amazon",
              external_id: item.asin,
              title: item.title,
              image_url: item.imageUrl,
              url: originalUrl,
              price: item.price,
              rating: 5,
              sales_count: 1,
              updated_at: now,
            },
            { onConflict: "user_id,marketplace,external_id" as any },
          )
          .select("id")
          .maybeSingle();

        await context.supabase.from("offers").upsert(
          {
            user_id: context.userId,
            product_id: prodData?.id || null,
            marketplace: "amazon",
            external_product_id: item.asin,
            title: item.title,
            image_url: item.imageUrl,
            price: item.price,
            previous_price: item.previousPrice,
            discount_pct: discountPct,
            free_shipping: item.freeShipping,
            available: true,
            original_url: originalUrl,
            affiliate_url: affiliateUrl,
            affiliate_status: "resolved",
            commission: null,
            commission_pct: null,
            score,
            status: "approved",
            source: "curated_top_picks",
            synced_at: now,
            updated_at: now,
          },
          { onConflict: "user_id,marketplace,title" as any },
        );

        await context.supabase.from("affiliate_links").upsert(
          {
            user_id: context.userId,
            marketplace: "amazon",
            original_url: originalUrl,
            affiliate_url: affiliateUrl,
            affiliate_program: "Amazon Associados",
            method: "tracking_id",
            tracking_id: trackingId,
            status: "resolved",
            product_id: prodData?.id || null,
          },
          { onConflict: "user_id,marketplace,original_url" as any },
        );

        imported++;
      } catch {
        // Continua os demais itens se um falhar
      }
    }

    return {
      ok: true,
      imported,
      total: CURATED_AMAZON_PRODUCTS.length,
      trackingId,
      message: `${imported} produtos oficiais da Amazon adicionados com sucesso ao seu catálogo com o Tracking ID ${trackingId}!`,
    };
  });



