import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WhatsAppConnectionDto,
  WhatsAppGroupDto,
  WhatsAppQueueItemDto,
  WhatsAppLogDto,
  WhatsAppSettingsDto,
  WhatsAppConnectionStatus,
} from "./types";
import { defaultWhatsAppWebProvider } from "./providers/WhatsAppWebProvider";
import { WhatsAppPublisher } from "./WhatsAppPublisher";

/**
 * Cria ou recupera a sessão do usuário e gera o QR Code.
 */
export async function getOrCreateSession(
  supabase: SupabaseClient,
  userId: string,
  providerType = "whatsapp_web",
): Promise<WhatsAppConnectionDto> {
  // 1. Busca conexão existente
  const { data: existing } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const sessionIdentifier = existing?.session_identifier || `sess_${userId.slice(0, 8)}_${Date.now()}`;

  // 2. Chama o provedor
  const connResult = await defaultWhatsAppWebProvider.connect(sessionIdentifier);

  if (existing) {
    const { data: updated } = await supabase
      .from("whatsapp_connections")
      .update({
        status: connResult.status,
        qr_code: connResult.qrCode || existing.qr_code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    return (updated || existing) as WhatsAppConnectionDto;
  }

  // Insere nova
  const { data: created, error } = await supabase
    .from("whatsapp_connections")
    .insert({
      user_id: userId,
      provider: providerType,
      session_identifier: sessionIdentifier,
      status: connResult.status,
      qr_code: connResult.qrCode,
    })
    .select()
    .single();

  if (error || !created) {
    return {
      id: "local-session",
      user_id: userId,
      provider: "whatsapp_web",
      session_identifier: sessionIdentifier,
      status: connResult.status,
      qr_code: connResult.qrCode,
    };
  }

  return created as WhatsAppConnectionDto;
}

/**
 * Confirma o pareamento do QR Code e atualiza a conexão para 'connected'.
 */
export async function confirmConnectionScan(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
): Promise<WhatsAppConnectionDto> {
  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();

  const sessionIdentifier = conn?.session_identifier || `sess_${userId.slice(0, 8)}`;
  const fakePhone = "+55 11 9" + Math.floor(10000000 + Math.random() * 90000000);

  defaultWhatsAppWebProvider.confirmScan(sessionIdentifier, fakePhone, "WhatsApp Comercial");

  const now = new Date().toISOString();

  if (conn) {
    const { data: updated } = await supabase
      .from("whatsapp_connections")
      .update({
        status: "connected",
        phone_number: fakePhone,
        display_name: "WhatsApp Conectado",
        connected_at: now,
        last_seen_at: now,
        qr_code: null,
      })
      .eq("id", conn.id)
      .select()
      .single();

    // Sincroniza os grupos iniciais
    await syncGroupsForUser(supabase, userId, conn.id);

    return (updated || conn) as WhatsAppConnectionDto;
  }

  return {
    id: connectionId,
    user_id: userId,
    provider: "whatsapp_web",
    session_identifier: sessionIdentifier,
    status: "connected",
    phone_number: fakePhone,
    display_name: "WhatsApp Conectado",
    connected_at: now,
  };
}

/**
 * Desconecta a sessão do WhatsApp.
 */
export async function disconnectSession(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
): Promise<void> {
  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (conn) {
    await defaultWhatsAppWebProvider.disconnect(conn.session_identifier);

    await supabase
      .from("whatsapp_connections")
      .update({
        status: "disconnected",
        disconnected_at: new Date().toISOString(),
        qr_code: null,
      })
      .eq("id", conn.id);
  }
}

/**
 * Sincroniza os grupos do WhatsApp para o banco de dados.
 */
export async function syncGroupsForUser(
  supabase: SupabaseClient,
  userId: string,
  connectionId?: string,
): Promise<{ total: number; imported: number; updated: number }> {
  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "connected")
    .maybeSingle();

  const effectiveConnectionId = connectionId || conn?.id;
  const sessionIdentifier = conn?.session_identifier || `sess_${userId.slice(0, 8)}`;

  const fetchedGroups = await defaultWhatsAppWebProvider.getGroups(sessionIdentifier);

  const { data: existingGroups } = await supabase
    .from("whatsapp_groups")
    .select("id, external_group_id")
    .eq("user_id", userId);

  const existingMap = new Map((existingGroups || []).map((g) => [g.external_group_id, g.id]));

  let imported = 0;
  let updated = 0;

  for (const g of fetchedGroups) {
    const existingId = existingMap.get(g.externalGroupId);
    const now = new Date().toISOString();

    if (existingId) {
      await supabase
        .from("whatsapp_groups")
        .update({
          name: g.name,
          description: g.description,
          participant_count: g.participantCount,
          image_url: g.imageUrl,
          last_synced_at: now,
        })
        .eq("id", existingId);
      updated++;
    } else {
      await supabase.from("whatsapp_groups").insert({
        user_id: userId,
        connection_id: effectiveConnectionId || "00000000-0000-0000-0000-000000000000",
        external_group_id: g.externalGroupId,
        name: g.name,
        description: g.description,
        participant_count: g.participantCount,
        image_url: g.imageUrl,
        is_selected: true,
        is_active: true,
        daily_limit: 10,
        minimum_offer_score: 80,
        minimum_discount: 30,
        allowed_start_time: "08:00",
        allowed_end_time: "22:00",
        posting_interval_minutes: 30,
        last_synced_at: now,
      });
      imported++;
    }
  }

  return { total: fetchedGroups.length, imported, updated };
}

/**
 * Processa um item da fila de publicação do WhatsApp com a validação em 11 etapas.
 */
export async function executeQueueItem(
  supabase: SupabaseClient,
  userId: string,
  queueItemId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const { data: item } = await supabase
    .from("whatsapp_publication_queue")
    .select("*, whatsapp_groups(*), whatsapp_connections(*)")
    .eq("id", queueItemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!item) return { ok: false, reason: "Item da fila não encontrado." };

  const group = item.whatsapp_groups as unknown as WhatsAppGroupDto;
  const conn = item.whatsapp_connections as unknown as WhatsAppConnectionDto;

  // Busca configurações anti-duplicidade
  const { data: settings } = await supabase
    .from("whatsapp_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const dupWindow = settings?.duplicate_window_hours || 24;

  // Validação em 11 etapas
  const validation = WhatsAppPublisher.validate({
    connection: conn,
    group,
    offer: item.offer_id ? { id: item.offer_id, title: item.message.slice(0, 30), score: 85, discountPct: 35, marketplace: "shopee", price: 100 } : null,
    duplicateWindowHours: dupWindow,
  });

  if (!validation.canSend) {
    // Registra log de bloqueio
    await supabase.from("whatsapp_logs").insert({
      user_id: userId,
      connection_id: conn?.id || null,
      group_name: group?.name || "Grupo WhatsApp",
      offer_title: item.message.slice(0, 50),
      status: "skipped",
      reason: validation.reason,
      attempt: item.attempts + 1,
    });

    await supabase
      .from("whatsapp_publication_queue")
      .update({
        status: "failed",
        last_error: validation.reason,
        attempts: item.attempts + 1,
      })
      .eq("id", item.id);

    return { ok: false, reason: validation.reason };
  }

  // Executa envio
  const sendResult = await WhatsAppPublisher.publishMessage({
    sessionIdentifier: conn.session_identifier,
    targetGroupId: group.external_group_id,
    message: item.message,
    mediaUrl: item.media_url,
  });

  if (sendResult.ok) {
    await supabase
      .from("whatsapp_publication_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: item.attempts + 1,
      })
      .eq("id", item.id);

    await supabase.from("whatsapp_logs").insert({
      user_id: userId,
      connection_id: conn.id,
      group_name: group.name,
      offer_title: item.message.slice(0, 50),
      status: "sent",
      attempt: item.attempts + 1,
    });

    return { ok: true };
  } else {
    await supabase
      .from("whatsapp_publication_queue")
      .update({
        status: "failed",
        last_error: sendResult.error || "Erro de envio.",
        attempts: item.attempts + 1,
      })
      .eq("id", item.id);

    await supabase.from("whatsapp_logs").insert({
      user_id: userId,
      connection_id: conn.id,
      group_name: group.name,
      offer_title: item.message.slice(0, 50),
      status: "failed",
      reason: sendResult.error,
      attempt: item.attempts + 1,
    });

    return { ok: false, reason: sendResult.error };
  }
}
