import type { IWhatsAppProvider } from "../WhatsAppProvider";
import type {
  ConnectionResult,
  WhatsAppConnectionStatus,
  SendResult,
} from "../types";

/**
 * Provedor para WhatsApp Business Cloud API Oficial da Meta.
 * Para contas comerciais e números verificados pelo WhatsApp Business Manager.
 */
export class OfficialWhatsAppProvider implements IWhatsAppProvider {
  private token: string;
  private phoneNumberId: string;

  constructor(token = process.env.WHATSAPP_CLOUD_TOKEN || "", phoneNumberId = process.env.WHATSAPP_PHONE_ID || "") {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
  }

  async connect(sessionIdentifier: string): Promise<ConnectionResult> {
    if (!this.token || !this.phoneNumberId) {
      return {
        status: "waiting_qr",
        sessionIdentifier,
        message: "API Oficial requer Token e Phone Number ID.",
      };
    }
    return {
      status: "connected",
      sessionIdentifier,
      message: "API Oficial conectada via Cloud API.",
    };
  }

  async disconnect(sessionIdentifier: string): Promise<void> {
    // Sem desconexão de socket na Cloud API
  }

  async getConnectionStatus(sessionIdentifier: string): Promise<{
    status: WhatsAppConnectionStatus;
    phoneNumber?: string | null;
    displayName?: string | null;
    qrCode?: string | null;
  }> {
    if (!this.token || !this.phoneNumberId) return { status: "disconnected" };
    return { status: "connected", phoneNumber: this.phoneNumberId };
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
    // Nota: A API Oficial da Meta não suporta listagem de grupos comuns por padrão
    return [];
  }

  async sendMessage(sessionIdentifier: string, toJid: string, text: string): Promise<SendResult> {
    if (!this.token || !this.phoneNumberId) return { ok: false, error: "Cloud API não configurada." };
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: toJid.replace("@g.us", "").replace("@s.whatsapp.net", ""),
          type: "text",
          text: { body: text },
        }),
      });
      const json = await res.json();
      return { ok: res.ok, messageId: json.messages?.[0]?.id };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async sendMedia(sessionIdentifier: string, toJid: string, mediaUrl: string, caption?: string): Promise<SendResult> {
    return this.sendMessage(sessionIdentifier, toJid, caption || mediaUrl);
  }
}
