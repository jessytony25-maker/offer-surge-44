import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
