import type { IWhatsAppProvider } from "../WhatsAppProvider";
import type {
  ConnectionResult,
  WhatsAppConnectionStatus,
  SendResult,
} from "../types";

/**
 * Provedor para gateways de WhatsApp via API HTTP / Webhooks
 * (compatível com Evolution API, Z-Api, WppConnect e Baileys Gateway).
 */
export class ExternalGatewayProvider implements IWhatsAppProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl = process.env["WHATSAPP_GATEWAY_URL"] || "", apiKey = process.env["WHATSAPP_GATEWAY_KEY"] || "") {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async connect(sessionIdentifier: string): Promise<ConnectionResult> {
    if (!this.baseUrl) {
      return {
        status: "waiting_qr",
        sessionIdentifier,
        message: "Gateway externo não configurado (adicione WHATSAPP_GATEWAY_URL).",
      };
    }
    try {
      const res = await fetch(`${this.baseUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.apiKey },
        body: JSON.stringify({ instanceName: sessionIdentifier, qrcode: true }),
      });
      const data = await res.json();
      return {
        status: data.qrcode ? "qr_ready" : "waiting_qr",
        qrCode: data.qrcode?.base64 || data.qrcode?.code,
        sessionIdentifier,
      };
    } catch {
      return {
        status: "error",
        sessionIdentifier,
        message: "Falha ao contatar gateway externo.",
      };
    }
  }

  async disconnect(sessionIdentifier: string): Promise<void> {
    if (!this.baseUrl) return;
    try {
      await fetch(`${this.baseUrl}/instance/logout/${sessionIdentifier}`, {
        method: "DELETE",
        headers: { apikey: this.apiKey },
      });
    } catch {}
  }

  async getConnectionStatus(sessionIdentifier: string): Promise<{
    status: WhatsAppConnectionStatus;
    phoneNumber?: string | null;
    displayName?: string | null;
    qrCode?: string | null;
  }> {
    if (!this.baseUrl) return { status: "disconnected" };
    try {
      const res = await fetch(`${this.baseUrl}/instance/connectionState/${sessionIdentifier}`, {
        headers: { apikey: this.apiKey },
      });
      const data = await res.json();
      const state = data.instance?.state;
      return {
        status: state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected",
      };
    } catch {
      return { status: "disconnected" };
    }
  }

  async getGroups(sessionIdentifier: string): Promise<
    Array<{
      externalGroupId: string;
      name: string;
      description?: string | null;
      participantCount: number;
      imageUrl?: string | null;
    }>
  > {
    if (!this.baseUrl) return [];
    try {
      const res = await fetch(`${this.baseUrl}/group/fetchAllGroups/${sessionIdentifier}`, {
        headers: { apikey: this.apiKey },
      });
      const groups = await res.json();
      return (groups || []).map((g: any) => ({
        externalGroupId: g.id,
        name: g.subject || "Grupo WhatsApp",
        description: g.desc,
        participantCount: g.size || g.participants?.length || 0,
        imageUrl: g.pictureUrl,
      }));
    } catch {
      return [];
    }
  }

  async sendMessage(sessionIdentifier: string, toJid: string, text: string): Promise<SendResult> {
    if (!this.baseUrl) return { ok: false, error: "Gateway não configurado." };
    try {
      const res = await fetch(`${this.baseUrl}/message/sendText/${sessionIdentifier}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.apiKey },
        body: JSON.stringify({ number: toJid, text }),
      });
      const json = await res.json();
      return { ok: res.ok, messageId: json.key?.id };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async sendMedia(sessionIdentifier: string, toJid: string, mediaUrl: string, caption?: string): Promise<SendResult> {
    if (!this.baseUrl) return { ok: false, error: "Gateway não configurado." };
    try {
      const res = await fetch(`${this.baseUrl}/message/sendMedia/${sessionIdentifier}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.apiKey },
        body: JSON.stringify({ number: toJid, mediaMessage: { mediaUrl, caption } }),
      });
      const json = await res.json();
      return { ok: res.ok, messageId: json.key?.id };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}
