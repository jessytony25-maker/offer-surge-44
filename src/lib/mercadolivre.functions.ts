import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Diagnóstico real da integração Mercado Livre em 10 etapas.
 * Nenhuma credencial é devolvida ao cliente — apenas o resultado de cada etapa.
 */
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

    // Persiste tokens renovados automaticamente (nunca expostos ao cliente).
    if (diag.refreshedTokens) {
      await context.supabase.from("integration_credentials").upsert(
        {
          user_id: context.userId,
          kind: "marketplace",
          provider: "mercadolivre",
          credentials: {
            ...record,
            access_token: diag.refreshedTokens.accessToken,
            refresh_token: diag.refreshedTokens.refreshToken,
          },
        },
        { onConflict: "user_id,kind,provider" },
      );
    }

    // Sync automático só é liberado com conexão validada; 403 não gera retry agressivo.
    await context.supabase.from("marketplace_connections").upsert(
      {
        user_id: context.userId,
        marketplace: "mercadolivre",
        status: diag.connectionStatus === "connected" ? "connected" : diag.connectionStatus === "not_configured" ? "not_configured" : "error",
        last_error: diag.connectionStatus === "connected" ? null : diag.summary,
        ...(diag.connectionStatus === "connected" ? {} : { auto_sync_interval: "disabled" }),
      },
      { onConflict: "user_id,marketplace" },
    );

    return {
      connectionStatus: diag.connectionStatus,
      summary: diag.summary,
      steps: diag.steps,
    };
  });

/**
 * Troca o código de autorização OAuth por tokens de acesso do Mercado Livre e salva de forma segura
 */
export const exchangeMeliCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { code: string; redirectUri: string }) =>
    z.object({ code: z.string(), redirectUri: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { code, redirectUri } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Buscar credenciais da aplicação salvas anteriormente pelo usuário
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

    if (!exchangeRes.ok) {
      return { ok: false, error: exchangeRes.message };
    }

    // 2. Salvar os novos access_token e refresh_token de forma segura no banco de dados
    await supabaseAdmin.from("integration_credentials").upsert(
      {
        user_id: context.userId,
        kind: "marketplace",
        provider: "mercadolivre",
        credentials: {
          ...record,
          access_token: exchangeRes.accessToken,
          refresh_token: exchangeRes.refreshToken,
        },
      },
      { onConflict: "user_id,kind,provider" },
    );

    // 3. Atualizar status da conexão para conectado
    await context.supabase.from("marketplace_connections").upsert(
      {
        user_id: context.userId,
        marketplace: "mercadolivre",
        status: "connected",
        last_error: null,
      },
      { onConflict: "user_id,marketplace" },
    );

    return { ok: true };
  });

