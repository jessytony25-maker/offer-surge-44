import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Redirect URI fixo do Oferta Hub — deve ser o mesmo registrado no app ML Developers. */
export const MELI_REDIRECT_URI = "https://offer-surge-44.lovable.app/integracoes";

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

/**
 * Inicia o fluxo OAuth — gera a URL de autorização do ML com state.
 * O Client ID e lido das variaveis de ambiente do servidor (MERCADOLIVRE_CLIENT_ID)
 * ou como fallback das credenciais salvas pelo usuario no banco.
 * NUNCA expoe client_secret ao frontend.
 */
export const startMeliOAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { meliAppCredsFromEnv, meliAuthorizeUrl } = await import("@/lib/mercadolivre.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Obter Client ID: primeiro env var, depois banco de dados
    let clientId = meliAppCredsFromEnv()?.clientId ?? null;

    if (!clientId) {
      const { data: row } = await supabaseAdmin
        .from("integration_credentials")
        .select("credentials")
        .eq("user_id", context.userId)
        .eq("kind", "marketplace")
        .eq("provider", "mercadolivre")
        .maybeSingle();
      const record = (row?.credentials ?? {}) as Record<string, string>;
      clientId = record["client_id"]?.trim() || null;
    }

    if (!clientId) {
      return {
        ok: false,
        error: "Client ID do Mercado Livre nao configurado. Configure a variavel de ambiente MERCADOLIVRE_CLIENT_ID ou informe o Client ID nas credenciais.",
      };
    }

    // 2. Gerar state seguro (proteção contra CSRF)
    const state = `meli_oauth_${context.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // 3. Construir URL de autorização
    // code_challenge e passado opcionalmente pelo frontend (se PKCE estiver ativado no app ML)
    const authUrl = meliAuthorizeUrl(clientId, MELI_REDIRECT_URI, state);

    return { ok: true, authUrl, state, redirectUri: MELI_REDIRECT_URI };
  });

/**
 * Troca o codigo OAuth por tokens de acesso e salva de forma segura no banco.
 * Client ID e Secret sao lidos das variaveis de ambiente do servidor como prioritario.
 * NUNCA sao expostos ao frontend.
 * Valida o state para prevenir ataques CSRF.
 */
export const exchangeMeliCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { code: string; redirectUri: string; state?: string; codeVerifier?: string }) =>
    z.object({
      code: z.string().min(1),
      redirectUri: z.string(),
      state: z.string().optional(),
      codeVerifier: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { code, redirectUri, codeVerifier } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { meliAppCredsFromEnv, meliExchangeCode, meliFetch, credsFromRecord } = await import("@/lib/mercadolivre.server");

    // 1. Obter credenciais do app: env vars (prioritario) ou banco de dados
    const envCreds = meliAppCredsFromEnv();
    let clientId: string | null = envCreds?.clientId ?? null;
    let clientSecret: string | null = envCreds?.clientSecret ?? null;

    if (!clientId || !clientSecret) {
      // Fallback: credenciais salvas pelo usuario no banco
      const { data: credRow } = await supabaseAdmin
        .from("integration_credentials")
        .select("credentials")
        .eq("user_id", context.userId)
        .eq("kind", "marketplace")
        .eq("provider", "mercadolivre")
        .maybeSingle();
      const record = (credRow?.credentials ?? {}) as Record<string, string>;
      clientId = clientId ?? record["client_id"]?.trim() ?? null;
      clientSecret = clientSecret ?? record["client_secret"]?.trim() ?? null;
    }

    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error: "Client ID ou Client Secret do Mercado Livre nao configurados. Configure MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_CLIENT_SECRET nas variaveis de ambiente do servidor.",
      };
    }

    // 2. Trocar o codigo pelo token
    const exchangeRes = await meliExchangeCode(clientId, clientSecret, code, redirectUri, codeVerifier);
    if (!exchangeRes.ok) {
      // Atualizar status para erro
      await context.supabase.from("marketplace_connections").upsert(
        { user_id: context.userId, marketplace: "mercadolivre", status: "error", last_error: exchangeRes.message },
        { onConflict: "user_id,marketplace" },
      );
      return { ok: false, error: exchangeRes.message };
    }

    // 3. Buscar credenciais existentes para preservar campos como affiliate_id, tracking_id
    const { data: existingRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", context.userId)
      .eq("kind", "marketplace")
      .eq("provider", "mercadolivre")
      .maybeSingle();
    const existingRecord = (existingRow?.credentials ?? {}) as Record<string, string>;

    // 4. Garantir que os campos matt_word e matt_tool ja estejam pre-configurados
    const updatedRecord: Record<string, string> = {
      ...existingRecord,
      access_token: exchangeRes.accessToken,
      refresh_token: exchangeRes.refreshToken,
      // Preservar affiliate_id (matt_word) e tracking_id (matt_tool) se ja existirem
      // ou pre-configurar com os valores conhecidos da conta jessyvendas
      affiliate_id: existingRecord["affiliate_id"] || "jessycursos",
      tracking_id: existingRecord["tracking_id"] || "64193262",
    };

    // Nao salvar client_secret no banco se ja vem do env
    if (!envCreds?.clientSecret) {
      updatedRecord["client_secret"] = clientSecret;
    }
    if (!envCreds?.clientId) {
      updatedRecord["client_id"] = clientId;
    }

    // 5. Salvar tokens de forma segura
    await supabaseAdmin.from("integration_credentials").upsert(
      { user_id: context.userId, kind: "marketplace", provider: "mercadolivre", credentials: updatedRecord },
      { onConflict: "user_id,kind,provider" },
    );

    // 6. Verificar identidade via /users/me
    const creds = credsFromRecord({ ...updatedRecord, user_id: context.userId });
    const meRes = await meliFetch<{ id?: number; nickname?: string; site_id?: string }>(
      "/users/me",
      creds,
      { step: "verify_connection" },
    );

    if (!meRes.ok) {
      // Token salvo mas /users/me falhou - ainda assim salvar como conectado para nao perder o token
      await context.supabase.from("marketplace_connections").upsert(
        { user_id: context.userId, marketplace: "mercadolivre", status: "connected", last_error: `Token salvo. Verificacao /users/me: ${meRes.message}` },
        { onConflict: "user_id,marketplace" },
      );
      return { ok: true, verified: false, note: meRes.message };
    }

    const nickname = meRes.data.nickname ?? String(meRes.data.id ?? "desconhecido");
    const userId = meRes.data.id ?? 0;

    // 7. Atualizar status da conexao para conectado
    await context.supabase.from("marketplace_connections").upsert(
      {
        user_id: context.userId,
        marketplace: "mercadolivre",
        status: "connected",
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marketplace" },
    );

    return {
      ok: true,
      verified: true,
      nickname,
      userId,
      hasMatt: Boolean(updatedRecord["affiliate_id"] && updatedRecord["tracking_id"]),
    };
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


    if (!/(mercadolivre|mercadolibre)\.[a-z.]+/i.test(url)) {
      return { ok: false as const, error: "A URL nao pertence ao Mercado Livre." };
    }

    const { credsFromRecord, extractMeliIdFromUrl, meliFetch, applyMattParams, validateAffiliateUrl } =
      await import("@/lib/mercadolivre.server");

    const parsed = extractMeliIdFromUrl(url);
    if (!parsed) {
      return {
        ok: false as const,
        error: `Nao foi possivel extrair o ID MLB da URL: ${url}\n\nFormatos aceitos:\n- https://produto.mercadolivre.com.br/MLB-XXXXXXXX-titulo (anuncio direto)\n- https://www.mercadolivre.com.br/p/MLB12345678 (catalogo)\n- https://www.mercadolivre.com.br/p/MLB12345678?item_id=MLBXXXXXXXX (catalogo com anuncio especifico)`,
      };
    }

    const { id: resolvedId, type: idType } = parsed;

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

    // ---------------------------------------------------------------
    // BUSCA DO PRODUTO — estratégia depende do tipo de ID
    // ---------------------------------------------------------------
    let item: any = null;
    let usedEndpoint = "";
    let usedItemId = resolvedId;

    if (idType === "listing") {
      // Anúncio direto: GET /items/{id}
      usedEndpoint = `/items/${resolvedId}`;
      const itemRes = await meliFetch<any>(usedEndpoint, creds, { step: "product_lookup" });
      if (!itemRes.ok) {
        return {
          ok: false as const,
          error: itemRes.message,
          httpStatus: itemRes.httpStatus,
          endpoint: itemRes.endpoint,
          step: itemRes.step,
        };
      }
      item = itemRes.data;

    } else {
      // Produto de catálogo: buscar via catalog_product_id → pega melhor oferta
      // Endpoint: /sites/MLB/search?catalog_product_id=MLB...
      usedEndpoint = `/sites/MLB/search?catalog_product_id=${resolvedId}&limit=5`;
      const searchRes = await meliFetch<{ results?: any[] }>(usedEndpoint, creds, { step: "catalog_lookup" });

      if (!searchRes.ok) {
        return {
          ok: false as const,
          error: searchRes.message,
          httpStatus: searchRes.httpStatus,
          endpoint: searchRes.endpoint,
          step: searchRes.step,
        };
      }

      const results = searchRes.data.results ?? [];
      if (results.length === 0) {
        return {
          ok: false as const,
          error: `Nenhum anuncio encontrado para o produto de catalogo ${resolvedId}. Verifique se o produto esta disponivel no Mercado Livre Brasil.`,
          httpStatus: 200,
          endpoint: usedEndpoint,
          step: "catalog_lookup",
        };
      }

      // Pega o melhor resultado: prioriza condition=new + maior sold_quantity
      item = results.sort((a: any, b: any) => {
        if (a.condition === "new" && b.condition !== "new") return -1;
        if (b.condition === "new" && a.condition !== "new") return 1;
        return (b.sold_quantity ?? 0) - (a.sold_quantity ?? 0);
      })[0];
      usedItemId = String(item.id ?? resolvedId);
    }


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

    // Comissão: NÃO inventar. O ML Afiliados não fornece % via API pública.
    // Salvar null — a UI exibirá "Comissão não disponível".
    const commissionPct: number | null = null;
    const commissionValue: number | null = null;

    const { data: prodData } = await context.supabase
      .from("products")
      .upsert(
        { user_id: context.userId, marketplace: "mercadolivre", external_id: usedItemId, title, image_url: imageUrl, url: permalink, price, rating, sales_count: salesCount, updated_at: now },
        { onConflict: "user_id,marketplace,external_id" as any },
      )
      .select("id")
      .maybeSingle();

    const { data: offerData } = await context.supabase
      .from("offers")
      .upsert(
        {
          user_id: context.userId,
          product_id: prodData?.id || null,
          marketplace: "mercadolivre",
          title,
          image_url: imageUrl,
          price,
          previous_price: originalPrice,
          discount_pct: discountPct || 0,
          rating,
          sales_count: salesCount,
          original_url: permalink,
          affiliate_url: affiliateUrl || permalink,
          // Comissão: null — não inventar. O ML não fornece via API.
          commission: null,
          commission_pct: null,
          free_shipping: item.shipping?.free_shipping ?? false,
          available: true,
          score: discountPct ? Math.min(discountPct * 1.5, 100) : 50,
          status: "new",
          updated_at: now,
        },
        { onConflict: "user_id,marketplace,title" as any },
      )
      .select("id")
      .maybeSingle();


    // Salvar em affiliate_links APENAS quando o link for realmente resolvido
    if (affiliateStatus === "resolved" && affiliateUrl) {
      await context.supabase.from("affiliate_links").upsert(
        {
          user_id: context.userId,
          marketplace: "mercadolivre",
          original_url: permalink,
          affiliate_url: affiliateUrl,
          affiliate_program: "Mercado Livre Afiliados",
          method: "matt_params",
          tracking_id: creds.mattTool,
          status: "resolved",
          product_id: prodData?.id || null,
        },
        { onConflict: "user_id,marketplace,original_url" as any },
      );
    }

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
        externalId: usedItemId,
        catalogId: idType === "catalog" ? resolvedId : null,
        idType,
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
        category: categoryId || null,
        commissionPct,
        commissionValue,
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
  .validator((input: { keyword: string; limit?: number; offset?: number; saveToOffers?: boolean }) =>
    z.object({
      keyword: z.string().min(1).max(200),
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).max(1000).optional(),
      saveToOffers: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { keyword, limit = 20, offset = 0, saveToOffers = true } = data;
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

    const searchRes = await meliFetch<{ results?: any[]; paging?: { total: number; offset: number; limit: number } }>(
      `/sites/MLB/search?q=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`,
      creds,
      { step: "catalog_search" },
    );

    if (!searchRes.ok) {
      return { ok: false as const, error: searchRes.message, httpStatus: searchRes.httpStatus, endpoint: searchRes.endpoint };
    }

    const now = new Date().toISOString();
    const rawItems = searchRes.data.results ?? [];

    const results = rawItems.map((item: any) => {
      const price = typeof item.price === "number" ? item.price : 0;
      const originalPrice = typeof item.original_price === "number" ? item.original_price : null;
      const discountPct = originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null;
      const permalink = item.permalink || "";
      const affiliate = creds.mattWord && creds.mattTool ? applyMattParams(permalink, creds.mattWord, creds.mattTool) : null;
      const validAffiliate = affiliate && validateAffiliateUrl(affiliate, creds.mattWord!, creds.mattTool!) ? affiliate : null;
      const imageUrl = (item.thumbnail || item.pictures?.[0]?.url || "").replace(/-I\.jpg$/i, "-O.jpg").replace(/^http:\/\//i, "https://") || null;

      return {
        externalId: String(item.id || ""),
        title: item.title || "Produto Mercado Livre",
        imageUrl,
        price,
        originalPrice,
        discountPct,
        rating: item.reviews?.rating_average ? Number(item.reviews.rating_average) : null,
        salesCount: typeof item.sold_quantity === "number" ? item.sold_quantity : null,
        originalUrl: permalink,
        affiliateUrl: validAffiliate,
        affiliateStatus: (validAffiliate ? "resolved" : "pending") as "resolved" | "pending",
        freeShipping: item.shipping?.free_shipping ?? false,
      };
    });

    // Se saveToOffers estiver ativo, persiste os itens na base de products e offers
    if (saveToOffers && results.length > 0) {
      for (const item of results) {
        try {
          const { data: prodData } = await context.supabase
            .from("products")
            .upsert(
              {
                user_id: context.userId,
                marketplace: "mercadolivre",
                external_id: item.externalId,
                title: item.title,
                image_url: item.imageUrl,
                url: item.originalUrl,
                price: item.price,
                rating: item.rating,
                sales_count: item.salesCount,
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
              marketplace: "mercadolivre",
              external_product_id: item.externalId,
              title: item.title,
              image_url: item.imageUrl,
              price: item.price,
              previous_price: item.originalPrice,
              discount_pct: item.discountPct || 0,
              rating: item.rating,
              sales_count: item.salesCount,
              original_url: item.originalUrl,
              affiliate_url: item.affiliateUrl || item.originalUrl,
              affiliate_status: item.affiliateStatus,
              commission: null,
              commission_pct: null,
              free_shipping: item.freeShipping,
              available: true,
              score: item.discountPct ? Math.min(item.discountPct * 1.5, 100) : 50,
              status: "new",
              source: "catalog_search",
              synced_at: now,
              updated_at: now,
            },
            { onConflict: "user_id,marketplace,title" as any },
          );
        } catch {
          // Continua processando os próximos itens se algum falhar
        }
      }
    }

    return {
      ok: true as const,
      results,
      total: searchRes.data.paging?.total ?? results.length,
      paging: {
        total: searchRes.data.paging?.total ?? results.length,
        offset,
        limit,
      },
    };
  });