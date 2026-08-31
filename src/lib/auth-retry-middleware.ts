import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

function isTokenSkewError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("issued at future") ||
    message.includes("token used before issued") ||
    message.includes("Unauthorized")
  );
}

/**
 * Anexa o bearer token do Supabase às chamadas de server functions.
 * Se o servidor recusar o token (ex.: desvio de relógio — "JWT issued at future"),
 * força uma renovação da sessão e tenta novamente uma única vez.
 */
export const attachSupabaseAuthWithRetry = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    try {
      return await next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch (error) {
      if (!isTokenSkewError(error)) throw error;

      const { data: refreshed } = await supabase.auth.refreshSession();
      const freshToken = refreshed.session?.access_token;
      if (!freshToken || freshToken === token) throw error;

      return await next({ headers: { Authorization: `Bearer ${freshToken}` } });
    }
  },
);
