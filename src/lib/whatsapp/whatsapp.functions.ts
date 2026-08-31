import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  WhatsAppConnectionDto,
  WhatsAppGroupDto,
  WhatsAppQueueItemDto,
  WhatsAppLogDto,
  WhatsAppSettingsDto,
} from "./types";

/** 1. Obtém ou inicializa a sessão de conexão do WhatsApp */
export const getWhatsAppConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppConnectionDto> => {
    const { getOrCreateSession } = await import("./whatsapp.server");
    return getOrCreateSession(context.supabase, context.userId);
  });

/** 2. Consulta o status real no gateway e atualiza a conexão caso o usuário tenha escaneado */
export const checkWhatsAppStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { connectionId?: string }) => input)
  .handler(async ({ data, context }): Promise<WhatsAppConnectionDto> => {
    const { checkSessionLiveStatus } = await import("./whatsapp.server");
    return checkSessionLiveStatus(context.supabase, context.userId, data?.connectionId);
  });

/** 3. Salva ou atualiza as credenciais do Gateway de WhatsApp */
export const saveWhatsAppGatewayConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      apiUrl: string;
      apiKey?: string;
      instanceName?: string;
    }) => {
      return z
        .object({
          apiUrl: z.string().min(1, "URL da API é obrigatória"),
          apiKey: z.string().optional(),
          instanceName: z.string().optional(),
        })
        .parse(input);
    },
  )
  .handler(async ({ data, context }): Promise<WhatsAppConnectionDto> => {
    const { updateGatewayCredentials } = await import("./whatsapp.server");
    return updateGatewayCredentials(context.supabase, context.userId, data);
  });

/** 4. Solicita a regeneração do QR Code no servidor do Gateway */
export const refreshWhatsAppQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppConnectionDto> => {
    const { getOrCreateSession } = await import("./whatsapp.server");
    return getOrCreateSession(context.supabase, context.userId);
  });

/** 5. Desconecta a sessão do WhatsApp de forma real */
export const disconnectWhatsAppSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { connectionId: string }) =>
    z.object({ connectionId: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { disconnectSession } = await import("./whatsapp.server");
    await disconnectSession(context.supabase, context.userId, data.connectionId);
    return { ok: true, message: "Sessão desconectada com sucesso." };
  });

/** 6. Lista os grupos cadastrados do usuário */
export const listWhatsAppGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppGroupDto[]> => {
    const { data } = await context.supabase
      .from("whatsapp_groups")
      .select("*")
      .eq("user_id", context.userId)
      .order("name", { ascending: true });

    return (data || []) as WhatsAppGroupDto[];
  });

/** 7. Sincroniza os grupos REAIS do WhatsApp */
export const syncWhatsAppGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncGroupsForUser } = await import("./whatsapp.server");
    const res = await syncGroupsForUser(context.supabase, context.userId);
    return {
      ok: true,
      message: `${res.total} grupos reais localizados (${res.imported} novos, ${res.updated} atualizados).`,
      ...res,
    };
  });

/** 8. Atualiza as configurações individuais de um grupo */
export const updateWhatsAppGroupConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        groupId: z.string(),
        is_selected: z.boolean().optional(),
        is_active: z.boolean().optional(),
        daily_limit: z.number().min(1).max(200).optional(),
        minimum_offer_score: z.number().min(0).max(100).optional(),
        minimum_discount: z.number().min(0).max(100).optional(),
        allowed_start_time: z.string().optional(),
        allowed_end_time: z.string().optional(),
        posting_interval_minutes: z.number().min(1).max(1440).optional(),
        allowed_marketplaces: z.array(z.string()).optional(),
        allowed_categories: z.array(z.string()).optional(),
        copy_template: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { groupId, ...fields } = data;
    const { error } = await context.supabase
      .from("whatsapp_groups")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", groupId)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true, message: "Configurações do grupo salvas com sucesso!" };
  });

/** 9. Lista os itens da fila de publicação */
export const listWhatsAppQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppQueueItemDto[]> => {
    const { data } = await context.supabase
      .from("whatsapp_publication_queue")
      .select("*, whatsapp_groups(name)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    return (data || []).map((row: any) => ({
      ...row,
      group_name: row.whatsapp_groups?.name,
    })) as WhatsAppQueueItemDto[];
  });

/** 10. Executa disparo de um item da fila através do gateway real */
export const processWhatsAppQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { queueItemId: string }) =>
    z.object({ queueItemId: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { executeQueueItem } = await import("./whatsapp.server");
    return executeQueueItem(context.supabase, context.userId, data.queueItemId);
  });

/** 11. Cancela um item da fila */
export const cancelWhatsAppQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { queueItemId: string }) =>
    z.object({ queueItemId: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_publication_queue")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.queueItemId)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true, message: "Publicação cancelada." };
  });

/** 12. Lista os logs de auditoria reais */
export const listWhatsAppLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppLogDto[]> => {
    const { data } = await context.supabase
      .from("whatsapp_logs")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    return (data || []) as WhatsAppLogDto[];
  });

/** 13. Busca configurações globais do WhatsApp */
export const getWhatsAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppSettingsDto> => {
    const { data } = await context.supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    return (
      (data as WhatsAppSettingsDto) || {
        user_id: context.userId,
        duplicate_window_hours: 24,
        global_daily_limit: 50,
        global_min_interval_minutes: 15,
        pause_on_disconnect: true,
      }
    );
  });

/** 14. Salva configurações globais do WhatsApp */
export const updateWhatsAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        duplicate_window_hours: z.number().min(1).max(168),
        global_daily_limit: z.number().min(1).max(500),
        global_min_interval_minutes: z.number().min(1).max(180),
        pause_on_disconnect: z.boolean(),
        default_api_url: z.string().optional().nullable(),
        default_api_key: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_settings")
      .upsert(
        {
          user_id: context.userId,
          ...data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (error) throw new Error(error.message);
    return { ok: true, message: "Configurações salvas com sucesso!" };
  });

/** 15. Métricas do WhatsApp para Dashboard */
export const getWhatsAppMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [connRes, groupsRes, queueRes] = await Promise.all([
      context.supabase
        .from("whatsapp_connections")
        .select("status")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("whatsapp_groups")
        .select("id, is_active, is_selected")
        .eq("user_id", context.userId),
      context.supabase
        .from("whatsapp_publication_queue")
        .select("status")
        .eq("user_id", context.userId),
    ]);

    const status = connRes.data?.status || "disconnected";
    const groups = groupsRes.data || [];
    const queue = queueRes.data || [];

    const activeGroups = groups.filter((g) => g.is_active && g.is_selected).length;
    const sentToday = queue.filter((q) => q.status === "sent").length;
    const pending = queue.filter((q) => q.status === "pending" || q.status === "scheduled").length;
    const failed = queue.filter((q) => q.status === "failed").length;

    return {
      connected: status === "connected",
      status,
      activeGroups,
      sentToday,
      pending,
      failed,
    };
  });

/** 16. Diagnóstico completo do Gateway de WhatsApp */
export const runWhatsAppDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { diagnoseWhatsAppGateway } = await import("./whatsapp.server");
    return diagnoseWhatsAppGateway(context.supabase, context.userId);
  });

/** 17. Envio de mensagem de teste para grupos reais do WhatsApp */
export const sendWhatsAppTestMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { groupId: string; message: string }) =>
    z
      .object({
        groupId: z.string(),
        message: z.string().min(1, "Mensagem não pode ser vazia"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { sendWhatsAppTestMessage } = await import("./whatsapp.server");
    return sendWhatsAppTestMessage(context.supabase, context.userId, data.groupId, data.message);
  });

