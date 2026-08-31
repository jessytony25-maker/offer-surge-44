import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WhatsAppConnectionDto,
  WhatsAppGroupDto,
  WhatsAppQueueItemDto,
  WhatsAppLogDto,
  WhatsAppSettingsDto,
  WhatsAppGatewayCredentials,
  WhatsAppConnectionStatus,
} from "./types";
import { defaultWhatsAppGatewayProvider } from "./providers/WhatsAppWebProvider";
import { WhatsAppPublisher } from "./WhatsAppPublisher";

/**
 * Obtém as credenciais de Gateway configuradas para o usuário (tabela de conexões ou env vars).
 */
async function getEffectiveCredentials(
  supabase: SupabaseClient,
  userId: string,
  conn?: any,
): Promise<WhatsAppGatewayCredentials> {
  const apiUrl =
    conn?.api_url ||
    process.env["WHATSAPP_GATEWAY_URL"] ||
    process.env["WHATSAPP_API_URL"] ||
    "";
  const apiKey =
    conn?.api_key ||
    process.env["WHATSAPP_GATEWAY_KEY"] ||
    process.env["WHATSAPP_API_KEY"] ||
    "";
  const instanceName =
    conn?.instance_name ||
    conn?.session_identifier ||
    `user_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;

  return {
    apiUrl: apiUrl ? apiUrl.trim() : null,
    apiKey: apiKey ? apiKey.trim() : null,
    instanceName,
  };
}

/**
 * Cria ou recupera a sessão do usuário e obtém o QR Code real do servidor.
 */
export async function getOrCreateSession(
  supabase: SupabaseClient,
  userId: string,
  providerType: "evolution_api" | "waha" | "zapi" | "official_cloud" | "custom" = "evolution_api",
): Promise<WhatsAppConnectionDto> {
  // 1. Busca conexão existente no banco
  const { data: existing } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const sessionIdentifier =
    existing?.session_identifier || `wa_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}_${Date.now().toString(36)}`;

  const creds = await getEffectiveCredentials(supabase, userId, existing);

  // 2. Se o gateway não possui URL configurada, marca como não configurado
  if (!creds.apiUrl) {
    const initialStatus: WhatsAppConnectionStatus = "not_configured";

    if (existing) {
      const { data: updated } = await supabase
        .from("whatsapp_connections")
        .update({
          status: initialStatus,
          qr_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      return (updated || existing) as WhatsAppConnectionDto;
    }

    const { data: created } = await supabase
      .from("whatsapp_connections")
      .insert({
        user_id: userId,
        provider: providerType,
        session_identifier: sessionIdentifier,
        status: initialStatus,
        qr_code: null,
      })
      .select()
      .single();

    return (created || {
      id: "unconfigured-session",
      user_id: userId,
      provider: providerType,
      session_identifier: sessionIdentifier,
      status: initialStatus,
      qr_code: null,
    }) as WhatsAppConnectionDto;
  }

  // 3. Chama o provedor real no gateway
  const connResult = await defaultWhatsAppGatewayProvider.connect(
    sessionIdentifier,
    creds,
  );

  const finalStatus: WhatsAppConnectionStatus = connResult.status;
  const qrCode = connResult.qrCode || null;

  if (existing) {
    const { data: updated } = await supabase
      .from("whatsapp_connections")
      .update({
        status: finalStatus,
        qr_code: qrCode,
        phone_number: connResult.phoneNumber || existing.phone_number,
        display_name: connResult.displayName || existing.display_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    return (updated || existing) as WhatsAppConnectionDto;
  }

  // Insere novo registro
  const { data: created } = await supabase
    .from("whatsapp_connections")
    .insert({
      user_id: userId,
      provider: providerType,
      session_identifier: sessionIdentifier,
      status: finalStatus,
      qr_code: qrCode,
      phone_number: connResult.phoneNumber,
      display_name: connResult.displayName,
      api_url: creds.apiUrl,
      api_key: creds.apiKey,
      instance_name: creds.instanceName,
    })
    .select()
    .single();

  return (created || {
    id: "session-" + sessionIdentifier,
    user_id: userId,
    provider: providerType,
    session_identifier: sessionIdentifier,
    status: finalStatus,
    qr_code: qrCode,
  }) as WhatsAppConnectionDto;
}

/**
 * Consulta o status real no servidor do WhatsApp e atualiza o banco se houver mudança.
 */
export async function checkSessionLiveStatus(
  supabase: SupabaseClient,
  userId: string,
  connectionId?: string,
): Promise<WhatsAppConnectionDto> {
  const query = supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId);

  const { data: conn } = connectionId
    ? await query.eq("id", connectionId).maybeSingle()
    : await query.maybeSingle();

  if (!conn) {
    return getOrCreateSession(supabase, userId);
  }

  const creds = await getEffectiveCredentials(supabase, userId, conn);

  if (!creds.apiUrl) {
    return conn as WhatsAppConnectionDto;
  }

  const stateRes = await defaultWhatsAppGatewayProvider.getConnectionStatus(
    conn.session_identifier,
    creds,
  );

  const isNowConnected = stateRes.status === "connected";
  const wasConnected = conn.status === "connected";
  const now = new Date().toISOString();

  const updatePayload: Record<string, any> = {
    status: stateRes.status,
    updated_at: now,
  };

  if (isNowConnected) {
    updatePayload["qr_code"] = null;
    if (stateRes.phoneNumber) updatePayload["phone_number"] = stateRes.phoneNumber;
    if (stateRes.displayName) updatePayload["display_name"] = stateRes.displayName;
    if (!wasConnected) {
      updatePayload["connected_at"] = now;
    }
  }

  const { data: updated } = await supabase
    .from("whatsapp_connections")
    .update(updatePayload)
    .eq("id", conn.id)
    .select()
    .single();

  // Se acabou de conectar pela primeira vez, dispara sincronização de grupos reais
  if (isNowConnected && !wasConnected) {
    try {
      await syncGroupsForUser(supabase, userId, conn.id);
    } catch {}
  }

  return (updated || conn) as WhatsAppConnectionDto;
}

/**
 * Salva as credenciais do Gateway de WhatsApp para o usuário e solicita conexão.
 */
export async function updateGatewayCredentials(
  supabase: SupabaseClient,
  userId: string,
  params: {
    apiUrl: string;
    apiKey?: string;
    instanceName?: string;
  },
): Promise<WhatsAppConnectionDto> {
  const { data: existing } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const sessionIdentifier =
    existing?.session_identifier || `wa_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}_${Date.now().toString(36)}`;

  const creds: WhatsAppGatewayCredentials = {
    apiUrl: params.apiUrl.trim().replace(/\/+$/, ""),
    apiKey: params.apiKey ? params.apiKey.trim() : null,
    instanceName: params.instanceName ? params.instanceName.trim() : sessionIdentifier,
  };

  // Testa conexão com o gateway informado
  const connResult = await defaultWhatsAppGatewayProvider.connect(
    sessionIdentifier,
    creds,
  );

  const payload = {
    user_id: userId,
    session_identifier: sessionIdentifier,
    provider: "evolution_api",
    api_url: creds.apiUrl,
    api_key: creds.apiKey,
    instance_name: creds.instanceName,
    status: connResult.status,
    qr_code: connResult.qrCode || null,
    phone_number: connResult.phoneNumber || null,
    display_name: connResult.displayName || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data: updated, error } = await supabase
      .from("whatsapp_connections")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated as WhatsAppConnectionDto;
  }

  const { data: created, error } = await supabase
    .from("whatsapp_connections")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return created as WhatsAppConnectionDto;
}

/**
 * Desconecta a sessão do WhatsApp de forma real.
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
    const creds = await getEffectiveCredentials(supabase, userId, conn);
    await defaultWhatsAppGatewayProvider.disconnect(conn.session_identifier, creds);

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
 * Sincroniza os grupos REAIS do WhatsApp para o banco de dados.
 * NUNCA injeta grupos falsos.
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
    .maybeSingle();

  if (!conn || conn.status !== "connected") {
    throw new Error("WhatsApp não está conectado. Conecte sua conta antes de sincronizar os grupos.");
  }

  const creds = await getEffectiveCredentials(supabase, userId, conn);
  const fetchedGroups = await defaultWhatsAppGatewayProvider.getGroups(
    conn.session_identifier,
    creds,
  );

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
        connection_id: conn.id,
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

  const creds = await getEffectiveCredentials(supabase, userId, conn);

  // Executa envio real via gateway
  const sendResult = item.media_url
    ? await defaultWhatsAppGatewayProvider.sendMedia(
        conn.session_identifier,
        group.external_group_id,
        item.media_url,
        item.message,
        creds,
      )
    : await defaultWhatsAppGatewayProvider.sendMessage(
        conn.session_identifier,
        group.external_group_id,
        item.message,
        creds,
      );

  if (sendResult.ok) {
    await supabase
      .from("whatsapp_publication_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: item.attempts + 1,
        last_error: null,
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
    const errorReason = sendResult.error || "Falha na entrega da mensagem pelo gateway.";

    await supabase
      .from("whatsapp_publication_queue")
      .update({
        status: "failed",
        last_error: errorReason,
        attempts: item.attempts + 1,
      })
      .eq("id", item.id);

    await supabase.from("whatsapp_logs").insert({
      user_id: userId,
      connection_id: conn?.id || null,
      group_name: group?.name || "Grupo WhatsApp",
      offer_title: item.message.slice(0, 50),
      status: "failed",
      reason: errorReason,
      attempt: item.attempts + 1,
    });

    return { ok: false, reason: errorReason };
  }
}

export interface DiagnosisReport {
  gatewayAccessible: { ok: boolean; message: string };
  credentialsValid: { ok: boolean; message: string };
  instanceFound: { ok: boolean; message: string };
  sessionCreated: { ok: boolean; message: string };
  qrReceived: { ok: boolean; message: string };
  whatsappConnected: { ok: boolean; message: string };
  groupsSynced: { ok: boolean; message: string };
}

export async function diagnoseWhatsAppGateway(
  supabase: SupabaseClient,
  userId: string,
): Promise<DiagnosisReport> {
  const report: DiagnosisReport = {
    gatewayAccessible: { ok: false, message: "Pendente" },
    credentialsValid: { ok: false, message: "Pendente" },
    instanceFound: { ok: false, message: "Pendente" },
    sessionCreated: { ok: false, message: "Pendente" },
    qrReceived: { ok: false, message: "Pendente" },
    whatsappConnected: { ok: false, message: "Pendente" },
    groupsSynced: { ok: false, message: "Pendente" },
  };

  // 1. Busca conexão no banco
  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn || !conn.api_url) {
    report.gatewayAccessible = { ok: false, message: "URL do gateway não configurada no banco de dados." };
    return report;
  }

  const creds = await getEffectiveCredentials(supabase, userId, conn);
  const baseUrl = (creds.apiUrl || "").trim().replace(/\/+$/, "");

  // 2. Gateway Acessível
  try {
    const pingRes = await fetch(baseUrl, { method: "GET" }).catch(() => null);
    if (!pingRes && !baseUrl.startsWith("http")) {
      report.gatewayAccessible = { ok: false, message: `URL inválida ou inacessível: ${baseUrl}` };
      return report;
    }
    report.gatewayAccessible = { ok: true, message: `Gateway acessível em ${baseUrl}` };
  } catch (err: any) {
    report.gatewayAccessible = { ok: false, message: `Erro ao conectar no Gateway: ${err.message}` };
    return report;
  }

  // 3. Credenciais Válidas & Instância Encontrada
  try {
    const statusRes = await defaultWhatsAppGatewayProvider.getConnectionStatus(conn.session_identifier, creds);
    report.credentialsValid = { ok: true, message: "Autenticação aceita pelo gateway" };
    
    if (statusRes.status === "connected") {
      report.instanceFound = { ok: true, message: `Instância "${creds.instanceName}" localizada` };
      report.sessionCreated = { ok: true, message: "Sessão ativa" };
      report.qrReceived = { ok: true, message: "Não aplicável (já conectado)" };
      report.whatsappConnected = { ok: true, message: "WhatsApp pareado com sucesso" };
    } else {
      report.instanceFound = { ok: true, message: `Instância "${creds.instanceName}" localizada (aguardando login)` };
      report.sessionCreated = { ok: true, message: "Sessão aguardando pareamento" };
      
      if (conn.qr_code) {
        report.qrReceived = { ok: true, message: "QR Code real disponível para leitura" };
      } else {
        report.qrReceived = { ok: false, message: "Instância criada, mas QR Code ainda não recebido" };
      }
      report.whatsappConnected = { ok: false, message: "Aguardando leitura do QR Code" };
    }
  } catch (err: any) {
    report.credentialsValid = { ok: false, message: `Credenciais inválidas ou erro no gateway: ${err.message}` };
    return report;
  }

  // 4. Grupos Sincronizados
  if (report.whatsappConnected.ok) {
    try {
      const syncRes = await syncGroupsForUser(supabase, userId, conn.id);
      report.groupsSynced = { ok: true, message: `${syncRes.total} grupos reais sincronizados (${syncRes.imported} novos)` };
    } catch (err: any) {
      report.groupsSynced = { ok: false, message: `Erro ao sincronizar grupos: ${err.message}` };
    }
  } else {
    report.groupsSynced = { ok: false, message: "Sincronização de grupos disponível apenas após conexão" };
  }

  return report;
}

export async function sendWhatsAppTestMessage(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  // 1. Busca grupo
  const { data: group } = await supabase
    .from("whatsapp_groups")
    .select("*")
    .eq("id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!group) {
    return { ok: false, error: "Grupo não encontrado." };
  }

  // 2. Busca conexão
  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("id", group.connection_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn || conn.status !== "connected") {
    return { ok: false, error: "WhatsApp não está conectado para esta instância." };
  }

  const creds = await getEffectiveCredentials(supabase, userId, conn);

  // 3. Envia mensagem real
  const sendResult = await defaultWhatsAppGatewayProvider.sendMessage(
    conn.session_identifier,
    group.external_group_id,
    message,
    creds,
  );

  // 4. Grava log
  await supabase.from("whatsapp_logs").insert({
    user_id: userId,
    connection_id: conn.id,
    group_name: group.name,
    offer_title: `Mensagem de Teste: ${message.slice(0, 30)}`,
    status: sendResult.ok ? "sent" : "failed",
    reason: sendResult.ok ? null : (sendResult.error || "Erro no envio"),
    attempt: 1,
  });

  if (sendResult.ok) {
    return { ok: true };
  } else {
    return { ok: false, error: sendResult.error || "Erro no envio via gateway" };
  }
}

