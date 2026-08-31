import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const diagnoseMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: row } = await context.supabase
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "mercadolivre")
      .maybeSingle();
    const record = (row?.credentials ?? {}) as Record<string, string>;
    const { meliDiagnose } = await import("@/lib/mercadolivre.server");
    const diag = await meliDiagnose(record);
    if (diag.refreshedTokens) {
      await context.supabase.from("integration_credentials").upsert(
        { user_id: context.userId, kind: "marketplace", provider: "mercadolivre", credentials: { ...record, access_token: diag.refreshedTokens.accessToken, refresh_token: diag.refreshedTokens.refreshToken } },
        { onConflict: "user_id,kind,provider" },
      );
    }
    await context.supabase.from("marketplace_connections").upsert(
      { user_id: context.userId, marketplace: "mercadolivre", status: diag.connectionStatus === "connected" ? "connected" : diag.connectionStatus === "not_configured" ? "not_configured" : "error", last_error: diag.connectionStatus === "connected" ? null : diag.summary, ...(diag.connectionStatus === "connected" ? {} : { auto_sync_interval: "disabled" }) },
      { onConflict: "user_id,marketplace" },
    );
    return { connectionStatus: diag.connectionStatus, summary: diag.summary, steps: diag.steps };
  });

export const exchangeMeliCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { code: string; redirectUri: string }) =>
    z.object({ code: z.string(), redirectUri: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { code, redirectUri } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "mercadolivre")
      .maybeSingle();
    const record = (credRow?.credentials ?? {}) as Record<string, string>;
    const clientId = record["client_id"]?.trim();
    const clientSecret = record["client_secret"]?.trim();
    if (!clientId || !clientSecret) {
      return { ok: false, error: "Configure o Client ID e Client Secret antes de autorizar o aplicativo." };
    }
    const { meliExchangeCode } = await import("@/lib/mercadolivre.server");
    const exchangeRes = await meliExchangeCode(clientId, clientSecret, code, redirectUri);
    if (!exchangeRes.ok) return { ok: false, error: exchangeRes.message };
    await supabaseAdmin.from("integration_credentials").upsert(
      { user_id: context.userId, kind: "marketplace", provider: "mercadolivre", credentials: { ...record, access_token: exchangeRes.accessToken, refresh_token: exchangeRes.refreshToken } },
      { onConflict: "user_id,kind,provider" },
    );
    await context.supabase.from("marketplace_connections").upsert(
      { user_id: context.userId, marketplace: "mercadolivre", status: "connected", last_error: null },
      { onConflict: "user_id,marketplace" },
    );
    return { ok: true };
  });

/**
 * Resolve um produto do Mercado Livre a partir de uma URL real.
 * Extrai o ID MLB, busca dados na API com token OAuth, aplica link de afiliado.
 * Salva nas tabelas existentes (products, offers) sem duplicar dados.
 * NUNCA inventa dados - se a API falhar, retorna o erro real com endpoint e httpStatus.
 */
export const resolveProductByUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { url: string }) =>
    z.object({ url: z.string().url("URL invalida") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { url } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { credsFromRecord, extractMeliId, meliFetch, applyMattParams, validateAffiliateUrl } =
      await import("@/lib/mercadolivre.server");

    if (!/(mercadolivre|mercadolibre)\.[a-z.]+/i.test(url)) {
      return { ok: false as const, error: "A URL nao pertence ao Mercado Livre." };
    }

    const itemId = extractMeliId(url);
    if (!itemId) {
      return {
        ok: false as const,
        error: `Nao foi possivel extrair o ID MLB da URL: ${url}\n\nFormatos aceitos:\n- https://produto.mercadolivre.com.br/MLB-XXXXXXXX-titulo-do-produto\n- https://www.mercadolivre.com.br/p/MLB12345678`,
      };
    }

    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "mercadolivre")
      .maybeSingle();

    const record = (credRow?.credentials ?? {}) as Record<string, string>;
    record["user_id"] = context.userId;
    const creds = credsFromRecord(record);

    // Busca dados reais — GET /items/{id} com Authorization: Bearer {token}
    // Sem token: retorna 403 com mensagem especifica, nao "erro de rede"
    const itemRes = await meliFetch<any>(`/items/${itemId}`, creds, { step: "product_lookup" });

    if (!itemRes.ok) {
      return {
        ok: false as const,
        error: itemRes.message,
        httpStatus: itemRes.httpStatus,
        endpoint: itemRes.endpoint,
        step: itemRes.step,
      };
    }

    const item = itemRes.data;
    const permalink = item.permalink || url;

    let affiliateUrl: string | null = null;
    let affiliateStatus: "resolved" | "pending" = "pending";
    let affiliateNote = "";

    if (creds.mattWord && creds.mattTool) {
      const candidate = applyMattParams(permalink, creds.mattWord, creds.mattTool);
      if (candidate && validateAffiliateUrl(candidate, creds.mattWord, creds.mattTool)) {
        affiliateUrl = candidate;
        affiliateStatus = "resolved";
      } else {
        affiliateNote = "Link de afiliado nao pode ser validado. Verifique os parametros matt_word/matt_tool nas credenciais.";
      }
    } else {
      affiliateNote =
        "matt_word e matt_tool nao configurados. Configure-os nas credenciais para gerar links de afiliado. Alternativa: use a extensao oficial do Mercado Livre.";
    }

    const price = typeof item.price === "number" ? item.price : 0;
    const originalPrice = typeof item.original_price === "number" ? item.original_price : null;
    const discountPct =
      originalPrice && originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : null;
    const imageUrl =
      (item.thumbnail || item.pictures?.[0]?.url || "")
        .replace(/-I\.jpg$/i, "-O.jpg")
        .replace(/^http:\/\//i, "https://") || null;
    const title = item.title || "Produto Mercado Livre";
    const rating = item.reviews?.rating_average ? Number(item.reviews.rating_average) : null;
    const salesCount = typeof item.sold_quantity === "number" ? item.sold_quantity : null;
    const now = new Date().toISOString();

    const { data: prodData } = await context.supabase
      .from("products")
      .upsert(
        { user_id: context.userId, marketplace: "mercadolivre", external_id: itemId, title, image_url: imageUrl, url: permalink, price, rating, sales_count: salesCount, updated_at: now },
        { onConflict: "user_id,marketplace,external_id" as any },
      )
      .select("id")
      .maybeSingle();

    const { data: offerData } = await context.supabase
      .from("offers")
      .upsert(
        { user_id: context.userId, product_id: prodData?.id || null, marketplace: "mercadolivre", title, image_url: imageUrl, price, previous_price: originalPrice, discount_pct: discountPct || 0, rating, sales_count: salesCount, original_url: permalink, affiliate_url: affiliateUrl || permalink, score: discountPct ? Math.min(discountPct * 1.5, 100) : 50, status: "new", updated_at: now },
        { onConflict: "user_id,marketplace,title" as any },
      )
      .select("id")
      .maybeSingle();

    const copyLines: string[] = [
      "\uD83D\uDD25 OLHA ESSE ACHADINHO QUE EU ACHEI!",
      "",
      `\uD83D\uDECD\uFE0F ${title}`,
      "",
    ];
    if (discountPct && discountPct > 0) copyLines.push(`\uD83D\uDD25 ${discountPct}% DE DESCONTO`, "");
    if (originalPrice && originalPrice > price) copyLines.push(`De: R$ ${originalPrice.toFixed(2).replace(".", ",")}`);
    copyLines.push(
      `\uD83D\uDCA5 Por: R$ ${price.toFixed(2).replace(".", ",")}`,
      "",
      "\uD83D\uDED2 Compre aqui:",
      affiliateUrl || permalink,
      "",
      "\u26A0\uFE0F Promocao sujeita a alteracao de preco e estoque.",
    );

    return {
      ok: true as const,
      product: {
        id: offerData?.id || null,
        externalId: itemId,
        title,
        imageUrl,
        price,
        originalPrice,
        discountPct,
        rating,
        salesCount,
        originalUrl: permalink,
        affiliateUrl,
        affiliateStatus,
        affiliateNote,
        freeShipping: item.shipping?.free_shipping ?? false,
        category: item.category_id || null,
      },
      copy: copyLines.join("\n"),
    };
  });

/**
 * Busca produtos no catalogo do Mercado Livre por keyword.
 * Requer access token OAuth - sem token retorna 403 com mensagem explicita.
 */
export const searchMeliProductsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { keyword: string; limit?: number }) =>
    z.object({ keyword: z.string().min(1).max(200), limit: z.number().int().min(1).max(50).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { keyword, limit = 20 } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { credsFromRecord, meliFetch, applyMattParams, validateAffiliateUrl } = await import("@/lib/mercadolivre.server");

    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "mercadolivre")
      .maybeSingle();

    const record = (credRow?.credentials ?? {}) as Record<string, string>;
    record["user_id"] = context.userId;
    const creds = credsFromRecord(record);

    const searchRes = await meliFetch<{ results?: any[] }>(
      `/sites/MLB/search?q=${encodeURIComponent(keyword)}&limit=${limit}`,
      creds,
      { step: "catalog_search" },
    );

    if (!searchRes.ok) {
      return { ok: false as const, error: searchRes.message, httpStatus: searchRes.httpStatus, endpoint: searchRes.endpoint };
    }

    const results = (searchRes.data.results ?? []).map((item: any) => {
      const price = typeof item.price === "number" ? item.price : 0;
      const originalPrice = typeof item.original_price === "number" ? item.original_price : null;
      const discountPct = originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null;
      const permalink = item.permalink || "";
      const affiliate = creds.mattWord && creds.mattTool ? applyMattParams(permalink, creds.mattWord, creds.mattTool) : null;
      const validAffiliate = affiliate && validateAffiliateUrl(affiliate, creds.mattWord!, creds.mattTool!) ? affiliate : null;
      return {
        externalId: String(item.id || ""),
        title: item.title || "Produto Mercado Livre",
        imageUrl: (item.thumbnail || "").replace(/-I\.jpg$/i, "-O.jpg").replace(/^http:\/\//i, "https://") || null,
        price,
        originalPrice,
        discountPct,
        originalUrl: permalink,
        affiliateUrl: validAffiliate,
        affiliateStatus: (validAffiliate ? "resolved" : "pending") as "resolved" | "pending",
        freeShipping: item.shipping?.free_shipping ?? false,
      };
    });

    return { ok: true as const, results, total: results.length };
  });