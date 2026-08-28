/**
 * Helpers server-only para configuração de integrações.
 * As credenciais nunca voltam para o cliente: apenas a lista de chaves preenchidas.
 */
import { CHANNEL_CONNECTORS, type ChannelPlatform } from "@/integrations/channels";
import { MARKETPLACE_ADAPTERS, type MarketplaceSlug } from "@/integrations/marketplaces";

export type IntegrationKind = "marketplace" | "channel";

export interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  help?: string;
}

export function fieldsFor(kind: IntegrationKind, provider: string): FieldDef[] {
  if (kind === "marketplace") {
    return MARKETPLACE_ADAPTERS[provider as MarketplaceSlug]?.credentialFields ?? [];
  }
  return CHANNEL_CONNECTORS[provider as ChannelPlatform]?.credentialFields ?? [];
}

export function providerName(kind: IntegrationKind, provider: string) {
  return kind === "marketplace"
    ? (MARKETPLACE_ADAPTERS[provider as MarketplaceSlug]?.name ?? provider)
    : (CHANNEL_CONNECTORS[provider as ChannelPlatform]?.name ?? provider);
}

export function isValidProvider(kind: IntegrationKind, provider: string) {
  return fieldsFor(kind, provider).length > 0;
}

/** Mescla o que veio do formulário com o que já estava salvo (campo vazio = manter). */
export function mergeCredentials(
  kind: IntegrationKind,
  provider: string,
  current: Record<string, string>,
  incoming: Record<string, string>,
) {
  const allowed = new Set(fieldsFor(kind, provider).map((f) => f.key));
  const next: Record<string, string> = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (!allowed.has(key)) continue;
    const clean = String(value ?? "").trim().slice(0, 4096);
    if (clean) next[key] = clean;
  }
  return next;
}

export function filledKeys(
  kind: IntegrationKind,
  provider: string,
  credentials: Record<string, string>,
) {
  return fieldsFor(kind, provider)
    .filter((f) => Boolean(credentials[f.key]))
    .map((f) => f.key);
}

export type TestOutcome = {
  status: "connected" | "pending" | "error";
  message: string;
  meta?: Record<string, unknown>;
};

async function testTelegram(creds: Record<string, string>): Promise<TestOutcome> {
  const token = creds["bot_token"];
  const chatId = creds["chat_id"];
  if (!token) return { status: "error", message: "Informe o Bot Token." };
  try {
    const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
    if (!me?.ok) {
      return { status: "error", message: "Bot Token inválido ou revogado." };
    }
    let chatTitle: string | undefined;
    if (chatId) {
      const chat = await fetch(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`,
      ).then((r) => r.json());
      if (!chat?.ok) {
        return {
          status: "error",
          message:
            "Bot válido, mas não consegui acessar o chat informado. Adicione o bot como administrador do grupo/canal.",
          meta: { bot: me.result?.username },
        };
      }
      chatTitle = chat.result?.title ?? chat.result?.username;
    }
    return {
      status: "connected",
      message: chatTitle
        ? `Conectado como @${me.result?.username} — destino: ${chatTitle}`
        : `Conectado como @${me.result?.username}`,
      meta: { bot: me.result?.username, chat_title: chatTitle },
    };
  } catch {
    return { status: "error", message: "Falha ao contatar a API do Telegram." };
  }
}

async function testWhatsApp(creds: Record<string, string>): Promise<TestOutcome> {
  const token = creds["access_token"];
  const phoneId = creds["phone_number_id"];
  if (!token || !phoneId) {
    return { status: "error", message: "Informe o Phone Number ID e o Access Token." };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json: Record<string, unknown> = await res.json();
    if (!res.ok) {
      const err = json["error"] as { message?: string } | undefined;
      return { status: "error", message: err?.message ?? "Credenciais recusadas pela Meta." };
    }
    return {
      status: "connected",
      message: `Conectado: ${String(json["verified_name"] ?? "")} (${String(json["display_phone_number"] ?? "")}). Lembrando: a API oficial não envia para grupos.`,
      meta: json,
    };
  } catch {
    return { status: "error", message: "Falha ao contatar a API da Meta." };
  }
}

export async function runTest(
  kind: IntegrationKind,
  provider: string,
  creds: Record<string, string>,
): Promise<TestOutcome> {
  if (kind === "channel") {
    if (provider === "telegram") return testTelegram(creds);
    if (provider === "whatsapp") return testWhatsApp(creds);
    return { status: "pending", message: "Canal sem verificação automática." };
  }

  const missing = fieldsFor(kind, provider)
    .filter((f) => !creds[f.key])
    .map((f) => f.label);
  if (missing.length) {
    return { status: "error", message: `Faltam credenciais: ${missing.join(", ")}.` };
  }
  return {
    status: "pending",
    message:
      "Credenciais salvas. A verificação automática deste marketplace depende da aprovação do programa de afiliados; a captura entra em fila assim que a API oficial responder.",
  };
}
