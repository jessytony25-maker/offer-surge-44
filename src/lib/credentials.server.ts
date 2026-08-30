/** Leitura server-only das credenciais salvas em integration_credentials. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getCredentials(
  userId: string,
  kind: "marketplace" | "channel",
  provider: string,
): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("integration_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("provider", provider)
    .maybeSingle();
  return (data?.credentials ?? {}) as Record<string, string>;
}
