/** Helpers server-only do painel administrativo. */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Garante que o chamador é administrador de verdade (checagem via RLS do usuário). */
export async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Falha ao validar permissão: ${error.message}`);
  if (!data) throw new Error("Acesso restrito a administradores.");
  return true;
}

/** Mascara um valor sensível mantendo apenas os últimos caracteres. */
export function maskSecret(value: string) {
  const clean = String(value ?? "");
  if (clean.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, clean.length - 4))}${clean.slice(-4)}`;
}
