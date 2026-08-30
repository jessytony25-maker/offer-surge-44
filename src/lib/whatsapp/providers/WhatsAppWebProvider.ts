import type { IWhatsAppProvider } from "../WhatsAppProvider";
import type {
  ConnectionResult,
  WhatsAppConnectionStatus,
  SendResult,
  WhatsAppGatewayCredentials,
} from "../types";

/**
 * Provedor Real de WhatsApp baseado em Gateway / Instâncias Multi-Device.
 *
 * Suporta instâncias de:
 * - Evolution API (v1 / v2)
 * - WAHA (WhatsApp HTTP API)
 * - Z-API
 * - Baileys Gateway HTTP
 *
 * NUNCA inventa QR Code, grupos, números de telefone ou confirmações de envio.
 * Se o gateway não estiver configurado ou offline, informa status claro.
 */
export class WhatsAppGatewayProvider implements IWhatsAppProvider {
  private defaultBaseUrl: string;
  private defaultApiKey: string;

  constructor(
    defaultBaseUrl = process.env.WHATSAPP_GATEWAY_URL || "",
    defaultApiKey = process.env.WHATSAPP_GATEWAY_KEY || process.env.WHATSAPP_API_KEY || "",
  ) {
    this.defaultBaseUrl = defaultBaseUrl.trim().replace(/\/+$/, "");
    this.defaultApiKey = defaultApiKey.trim();
  }

  private resolveCredentials(custom?: WhatsAppGatewayCredentials): {
    baseUrl: string;
    apiKey: string;
  } {
    const baseUrl = (custom?.apiUrl || this.defaultBaseUrl || "").trim().replace(/\/+$/, "");
    const apiKey = (custom?.apiKey || this.defaultApiKey || "").trim();
    return { baseUrl, apiKey };
  }

  /**
   * Solicita ao gateway a criação ou recuperação da instância e geração do QR Code REAL.
   */
  async connect(
    sessionIdentifier: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<ConnectionResult> {
    const { baseUrl, apiKey } = this.resolveCredentials(credentials);

    if (!baseUrl) {
      return {
        status: "not_configured",
        sessionIdentifier,
        message: "Gateway de WhatsApp não configurado. Adicione a URL do servidor e a chave de API.",
        qrCode: null,
      };
    }

    const instanceName = credentials?.instanceName || sessionIdentifier;

    try {
      // 1. Verifica se a instância já existe e está conectada
      const stateRes = await this.getConnectionStatus(sessionIdentifier, credentials);
      if (stateRes.status === "connected") {
        return {
          status: "connected",
          sessionIdentifier,
          phoneNumber: stateRes.phoneNumber,
          displayName: stateRes.displayName,
          message: "WhatsApp já conectado na instância.",
        };
      }

      // 2. Tenta conectar ou criar a instância no gateway
      // Tentativa 1: Evolution API endpoint /instance/connect/{instance}
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["apikey"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      let qrCode: string | null = null;
      let status: WhatsAppConnectionStatus = "waiting_qr";

      // Tenta connect primeiro
      const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
        method: "GET",
        headers,
      }).catch(() => null);

      if (connectRes && connectRes.ok) {
        const data = await connectRes.json().catch(() => ({}));
        qrCode = data.base64 || data.qrcode?.base64 || data.code || data.qrcode?.code || null;
        if (qrCode) status = "qr_ready";
      }

      // Se não encontrou QR, tenta criar a instância
      if (!qrCode) {
        const createRes = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          }),
        }).catch(() => null);

        if (createRes) {
          const createData = await createRes.json().catch(() => ({}));
          qrCode = createData.base64 || createData.qrcode?.base64 || createData.code || createData.qrcode?.code || null;
          if (qrCode) status = "qr_ready";
        }
      }

      // Fallback para WAHA endpoint /api/sessions/start ou /api/{instance}/auth/qr
      if (!qrCode) {
        const wahaRes = await fetch(`${baseUrl}/api/sessions/start`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name: instanceName }),
        }).catch(() => null);

        if (wahaRes && wahaRes.ok) {
          const wahaQr = await fetch(`${baseUrl}/api/${instanceName}/auth/qr`, { headers }).catch(() => null);
          if (wahaQr && wahaQr.ok) {
            const qrJson = await wahaQr.json().catch(() => ({}));
            qrCode = qrJson.raw || qrJson.base64 || null;
            if (qrCode) status = "qr_ready";
          }
        }
      }

      return {
        status: qrCode ? "qr_ready" : "waiting_qr",
        qrCode,
        sessionIdentifier,
        message: qrCode
          ? "QR Code real recebido do servidor. Escaneie com o WhatsApp do seu celular."
          : "Instância inicializada. Aguardando geração do QR Code pelo servidor.",
      };
    } catch (err: any) {
      return {
        status: "error",
        sessionIdentifier,
        message: `Falha na comunicação com o gateway do WhatsApp: ${err.message || "Erro de rede"}`,
        qrCode: null,
      };
    }
  }

  /**
   * Desconecta a sessão de forma real no servidor do gateway.
   */
  async disconnect(
    sessionIdentifier: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<void> {
    const { baseUrl, apiKey } = this.resolveCredentials(credentials);
    if (!baseUrl) return;

    const instanceName = credentials?.instanceName || sessionIdentifier;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["apikey"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
        method: "DELETE",
        headers,
      }).catch(() => null);
    } catch {}
  }

  /**
   * Consulta o status real da conexão diretamente no gateway.
   */
  async getConnectionStatus(
    sessionIdentifier: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<{
    status: WhatsAppConnectionStatus;
    phoneNumber?: string | null;
    displayName?: string | null;
    qrCode?: string | null;
  }> {
    const { baseUrl, apiKey } = this.resolveCredentials(credentials);
    if (!baseUrl) return { status: "not_configured" };

    const instanceName = credentials?.instanceName || sessionIdentifier;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["apikey"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      // 1. Tenta Evolution API /instance/connectionState/{instance}
      const res = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
        headers,
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        const state = data.instance?.state || data.state;

        if (state === "open" || state === "connected") {
          // Busca dados do proprietário da conexão
          const infoRes = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
            headers,
          }).catch(() => null);
          let phone: string | null = null;
          let name: string | null = null;

          if (infoRes && infoRes.ok) {
            const infoData = await infoRes.json().catch(() => []);
            const inst = Array.isArray(infoData) ? infoData[0] : infoData;
            phone = inst?.owner || inst?.phoneNumber || null;
            name = inst?.profileName || inst?.name || null;
          }

          return {
            status: "connected",
            phoneNumber: phone ? phone.replace("@s.whatsapp.net", "").replace("@c.us", "") : null,
            displayName: name || "WhatsApp Conectado",
          };
        }

        if (state === "connecting") {
          return { status: "connecting" };
        }
      }

      // 2. Tenta WAHA /api/sessions/{instance}
      const wahaRes = await fetch(`${baseUrl}/api/sessions/${instanceName}`, {
        headers,
      }).catch(() => null);

      if (wahaRes && wahaRes.ok) {
        const wahaData = await wahaRes.json().catch(() => ({}));
        if (wahaData.status === "WORKING" || wahaData.status === "CONNECTED") {
          return {
            status: "connected",
            phoneNumber: wahaData.me?.id?.replace("@c.us", "") || null,
            displayName: wahaData.me?.pushName || "WhatsApp Conectado",
          };
        }
        if (wahaData.status === "SCAN_QR_CODE") {
          return { status: "qr_ready" };
        }
      }

      return { status: "disconnected" };
    } catch {
      return { status: "disconnected" };
    }
  }

  /**
   * Busca os grupos REAIS onde o número autenticado participa.
   * NUNCA retorna grupos inventados ou fictícios.
   */
  async getGroups(
    sessionIdentifier: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<
    Array<{
      externalGroupId: string;
      name: string;
      description?: string | null;
      participantCount: number;
      imageUrl?: string | null;
    }>
  > {
    const { baseUrl, apiKey } = this.resolveCredentials(credentials);
    if (!baseUrl) return [];

    const instanceName = credentials?.instanceName || sessionIdentifier;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["apikey"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      // 1. Tenta Evolution API /group/fetchAllGroups/{instance}
      const res = await fetch(`${baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=true`, {
        headers,
      }).catch(() => null);

      if (res && res.ok) {
        const groups = await res.json().catch(() => []);
        if (Array.isArray(groups)) {
          return groups.map((g: any) => ({
            externalGroupId: g.id || g.jid || "",
            name: g.subject || g.name || "Grupo sem título",
            description: g.desc || g.description || null,
            participantCount: g.size || g.participants?.length || 0,
            imageUrl: g.pictureUrl || g.profilePictureUrl || null,
          })).filter((g) => Boolean(g.externalGroupId));
        }
      }

      // 2. Tenta WAHA /api/{instance}/groups
      const wahaRes = await fetch(`${baseUrl}/api/${instanceName}/groups`, {
        headers,
      }).catch(() => null);

      if (wahaRes && wahaRes.ok) {
        const wahaGroups = await wahaRes.json().catch(() => []);
        if (Array.isArray(wahaGroups)) {
          return wahaGroups.map((g: any) => ({
            externalGroupId: g.id?._serialized || g.id || "",
            name: g.name || "Grupo WhatsApp",
            description: g.description || null,
            participantCount: g.participants?.length || 0,
            imageUrl: g.pictureUrl || null,
          })).filter((g) => Boolean(g.externalGroupId));
        }
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Envia mensagem de texto REAL para o grupo através do gateway.
   * NUNCA simula sucesso quando o envio falha.
   */
  async sendMessage(
    sessionIdentifier: string,
    toJid: string,
    text: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<SendResult> {
    const { baseUrl, apiKey } = this.resolveCredentials(credentials);
    if (!baseUrl) {
      return { ok: false, error: "Gateway de WhatsApp não configurado." };
    }

    const instanceName = credentials?.instanceName || sessionIdentifier;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["apikey"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: toJid,
          text,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = json?.message || json?.error || `HTTP ${res.status}: ${res.statusText}`;
        return { ok: false, error: errMsg };
      }

      return {
        ok: true,
        messageId: json?.key?.id || json?.messageId || json?.id,
      };
    } catch (err: any) {
      return { ok: false, error: `Falha no envio: ${err.message || "Erro de conexão com o gateway"}` };
    }
  }

  /**
   * Envia mídia REAL para o grupo através do gateway.
   */
  async sendMedia(
    sessionIdentifier: string,
    toJid: string,
    mediaUrl: string,
    caption?: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<SendResult> {
    const { baseUrl, apiKey } = this.resolveCredentials(credentials);
    if (!baseUrl) {
      return { ok: false, error: "Gateway de WhatsApp não configurado." };
    }

    const instanceName = credentials?.instanceName || sessionIdentifier;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["apikey"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      const res = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: toJid,
          mediaMessage: {
            mediaUrl,
            caption: caption || "",
          },
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Tenta fallback para sendMessage com link
        return this.sendMessage(sessionIdentifier, toJid, `${caption ? caption + "\n\n" : ""}${mediaUrl}`, credentials);
      }

      return {
        ok: true,
        messageId: json?.key?.id || json?.messageId || json?.id,
      };
    } catch (err: any) {
      return { ok: false, error: `Falha no envio de mídia: ${err.message || "Erro de conexão com o gateway"}` };
    }
  }
}

export const defaultWhatsAppWebProvider = new WhatsAppGatewayProvider();
export const defaultWhatsAppGatewayProvider = defaultWhatsAppWebProvider;
