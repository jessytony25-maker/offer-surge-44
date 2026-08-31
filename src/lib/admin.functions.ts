import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Diz se o usuário logado é administrador. */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

/** Visão geral real da plataforma (somente admin). */
export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const count = async (table: string) => {
      const { count: c } = await supabaseAdmin
        .from(table as never)
        .select("id", { count: "exact", head: true });
      return c ?? 0;
    };

    const [users, offers, publications, automations, groups, credentials] = await Promise.all([
      count("profiles"),
      count("offers"),
      count("publications"),
      count("automations"),
      count("groups"),
      count("integration_credentials"),
    ]);

    const { data: commissionRows } = await supabaseAdmin.from("commissions").select("amount");
    const revenue = (commissionRows ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);

    const { data: logs } = await supabaseAdmin
      .from("audit_logs")
      .select("id, user_id, channel, action, level, entity, created_at, meta")
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: runs } = await supabaseAdmin
      .from("automation_runs")
      .select("id, automation_id, status, offers_published, errors, started_at")
      .order("started_at", { ascending: false })
      .limit(15);

    return {
      metrics: { users, offers, publications, automations, groups, credentials, revenue },
      logs: logs ?? [],
      runs: runs ?? [],
    };
  });

/** Lista real de usuários com plano, papéis e integrações configuradas. */
export const adminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, maskSecret } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, company, created_at");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, status, current_period_end");
    const { data: creds } = await supabaseAdmin
      .from("integration_credentials")
      .select("user_id, kind, provider, credentials, updated_at");

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));

    return (authList?.users ?? []).map((u) => {
      const userCreds = (creds ?? [])
        .filter((c) => c.user_id === u.id)
        .map((c) => ({
          kind: c.kind,
          provider: c.provider,
          updated_at: c.updated_at,
          fields: Object.entries((c.credentials ?? {}) as Record<string, string>).map(
            ([key, value]) => ({ key, masked: maskSecret(String(value)) }),
          ),
        }));

      return {
        id: u.id,
        email: u.email ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
        confirmed: Boolean(u.email_confirmed_at),
        full_name: profileById.get(u.id)?.full_name ?? null,
        company: profileById.get(u.id)?.company ?? null,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
        plan: subByUser.get(u.id)?.plan ?? "free",
        plan_status: subByUser.get(u.id)?.status ?? "inactive",
        credentials: userCreds,
      };
    });
  });

/** Concede ou revoga o papel de administrador. */
export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "user"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.grant && data.userId === context.userId && data.role === "admin") {
      throw new Error("Você não pode remover o seu próprio acesso de administrador.");
    }

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      channel: "admin",
      action: data.grant ? "grant_role" : "revoke_role",
      entity: "user_roles",
      entity_id: data.userId,
      level: "warn",
      meta: { role: data.role },
    });
    return { ok: true as const };
  });

/** Atualiza o plano/assinatura de um usuário. */
export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        plan: z.enum(["free", "basic", "pro", "business"]),
        status: z.enum(["active", "inactive", "canceled"]).default("active"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: data.userId,
          plan: data.plan,
          status: data.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Configurações globais da plataforma. */
export const adminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("admin_settings")
      .select("*")
      .order("key", { ascending: true });
    return data ?? [];
  });

export const adminSaveSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        key: z.string().min(1).max(80),
        value: z.string().max(4000),
        description: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let parsed: unknown = data.value;
    try {
      parsed = JSON.parse(data.value);
    } catch {
      parsed = data.value;
    }

    const { error } = await supabaseAdmin.from("admin_settings").upsert(
      {
        key: data.key,
        value: parsed as never,
        description: data.description ?? null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
