/** Leitura das credenciais salvas em integration_credentials (RLS por usuário). */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCredentials(
  supabase: SupabaseClient,
  userId: string,
  kind: "marketplace" | "channel",
  provider: string,
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("integration_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("provider", provider)
    .maybeSingle();
  return (data?.credentials ?? {}) as Record<string, string>;
}
