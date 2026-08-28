/**
 * CHANNEL_CONNECTOR — camada de publicação em canais.
 *
 * Só contempla caminhos oficiais/permitidos pelas plataformas. Nada de
 * automação não oficial de WhatsApp: a publicação exige a API oficial
 * (WhatsApp Business Platform) ou um provedor autorizado.
 */

export type ChannelPlatform = "whatsapp" | "telegram" | "other";

export type ChannelState = "not_configured" | "pending" | "connected" | "error";

export interface ChannelCredentialField {
  key: string;
  label: string;
  secret?: boolean;
  help?: string;
}

export interface ChannelTarget {
  id: string;
  name: string;
}

export type ChannelResult<T> =
  | { ok: true; data: T }
  | { ok: false; state: ChannelState; message: string };

export interface ChannelConnector {
  platform: ChannelPlatform;
  name: string;
  /** Via oficial suportada pela plataforma. */
  transport: string;
  policyNote: string;
  credentialFields: ChannelCredentialField[];
  testConnection(): Promise<ChannelResult<{ at: string }>>;
  listTargets(): Promise<ChannelResult<ChannelTarget[]>>;
  send(targetId: string, message: string): Promise<ChannelResult<{ messageId: string }>>;
}

const awaiting = <T,>(name: string): ChannelResult<T> => ({
  ok: false,
  state: "not_configured",
  message: `Integração aguardando configuração — ${name}`,
});

export const whatsappConnector: ChannelConnector = {
  platform: "whatsapp",
  name: "WhatsApp",
  transport: "WhatsApp Business Platform (API oficial) ou provedor autorizado",
  policyNote:
    "Somente envio por API oficial ou provedor homologado. Automação não oficial não é suportada.",
  credentialFields: [
    { key: "phone_number_id", label: "Phone Number ID" },
    { key: "business_account_id", label: "WhatsApp Business Account ID" },
    { key: "access_token", label: "Access Token", secret: true },
  ],
  async testConnection() {
    return awaiting("WhatsApp");
  },
  async listTargets() {
    return awaiting("WhatsApp");
  },
  async send() {
    return awaiting("WhatsApp");
  },
};

export const telegramConnector: ChannelConnector = {
  platform: "telegram",
  name: "Telegram",
  transport: "Telegram Bot API",
  policyNote: "O bot precisa ser administrador do canal/grupo de destino.",
  credentialFields: [
    { key: "bot_token", label: "Bot Token", secret: true },
    { key: "chat_id", label: "Chat ID do grupo/canal" },
  ],
  async testConnection() {
    return awaiting("Telegram");
  },
  async listTargets() {
    return awaiting("Telegram");
  },
  async send() {
    return awaiting("Telegram");
  },
};

export const CHANNEL_CONNECTORS: Record<ChannelPlatform, ChannelConnector> = {
  whatsapp: whatsappConnector,
  telegram: telegramConnector,
  other: {
    platform: "other",
    name: "Outro canal",
    transport: "Conector personalizado",
    policyNote: "Arquitetura preparada para novos canais.",
    credentialFields: [],
    async testConnection() {
      return awaiting("Canal personalizado");
    },
    async listTargets() {
      return awaiting("Canal personalizado");
    },
    async send() {
      return awaiting("Canal personalizado");
    },
  },
};

export const CHANNEL_LIST = Object.values(CHANNEL_CONNECTORS);

export const channelName = (platform?: string | null) =>
  platform ? (CHANNEL_CONNECTORS[platform as ChannelPlatform]?.name ?? platform) : "—";
