import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const configSchema = z.record(z.string(), z.unknown());

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  active: z.boolean(),
  group_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  start_time: z.string(),
  end_time: z.string(),
  daily_limit: z.number().int().min(1).max(500),
  interval_minutes: z.number().int().min(1).max(1440),
  config: configSchema,
});

/** Lista as automações reais persistidas no banco. */
export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("automations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await context.supabase
      .from("publications")
      .select("id", { count: "exact", head: true })
      .gte("published_at", todayStart.toISOString());

    const { data: runs } = await context.supabase
      .from("automation_runs")
      .select("automation_id, offers_published")
      .gte("started_at", todayStart.toISOString());

    const sentToday: Record<string, number> = {};
    for (const r of runs ?? []) {
      sentToday[r.automation_id] = (sentToday[r.automation_id] ?? 0) + (r.offers_published ?? 0);
    }

    return { automations: data ?? [], publishedToday: count ?? 0, sentToday };
  });

/** Cria ou atualiza uma automação real. */
export const saveAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      name: data.name,
      active: data.active,
      group_id: data.group_id ?? null,
      template_id: data.template_id ?? null,
      start_time: data.start_time,
      end_time: data.end_time,
      daily_limit: data.daily_limit,
      interval_minutes: data.interval_minutes,
      config: data.config as never,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("automations")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("automations")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { id: inserted?.id ?? "" };
  });

export const toggleAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automations")
      .update({ active: data.active, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("automation_runs").delete().eq("automation_id", data.id);
    await context.supabase.from("automation_rules").delete().eq("automation_id", data.id);
    const { error } = await context.supabase.from("automations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Executa a automação de verdade: filtra ofertas reais e publica nos canais. */
export const executeAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), ignoreWindow: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { runAutomation } = await import("@/lib/automation.server");
    return runAutomation(context.supabase, context.userId, data.id, {
      ignoreWindow: data.ignoreWindow ?? false,
    });
  });

/** Executa todas as automações ativas (usado pelo botão "Publicar tudo" e por agendadores). */
export const executeAllAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runAutomation } = await import("@/lib/automation.server");
    const { data: rows } = await context.supabase
      .from("automations")
      .select("id, name")
      .eq("active", true);

    const results = [] as Array<{ id: string; name: string; message: string; published: number; queued: number }>;
    for (const row of rows ?? []) {
      const res = await runAutomation(context.supabase, context.userId, row.id);
      results.push({
        id: row.id,
        name: row.name,
        message: res.message,
        published: res.published,
        queued: res.queued,
      });
    }
    return {
      total: results.length,
      published: results.reduce((a, r) => a + r.published, 0),
      queued: results.reduce((a, r) => a + r.queued, 0),
      results,
    };
  });

/** Histórico real de execuções. */
export const automationRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("automation_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });
