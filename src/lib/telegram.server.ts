/** Cliente server-only da Telegram Bot API (via oficial). */

type TgResponse<T> = { ok: boolean; result?: T; description?: string };

async function tg<T>(token: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return (await res.json()) as TgResponse<T>;
}

export interface TgChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

export async function tgGetMe(token: string) {
  return tg<{ id: number; username?: string; first_name?: string }>(token, "getMe");
}

/**
 * Descobre os grupos/canais onde o bot foi adicionado, lendo as atualizações
 * pendentes (my_chat_member / message). É o caminho oficial: o usuário adiciona
 * o bot pelo link/QR e a plataforma importa os destinos.
 */
export async function tgDiscoverChats(token: string): Promise<TgChat[]> {
  const res = await tg<Record<string, unknown>[]>(token, "getUpdates", {
    limit: 100,
    timeout: 0,
    allowed_updates: ["message", "my_chat_member", "channel_post", "chat_member"],
  });
  if (!res.ok || !res.result) return [];
  const found = new Map<number, TgChat>();
  for (const update of res.result) {
    for (const key of ["my_chat_member", "chat_member", "message", "channel_post"]) {
      const node = update[key] as { chat?: TgChat } | undefined;
      const chat = node?.chat;
      if (chat && chat.id && chat.type !== "private") found.set(chat.id, chat);
    }
  }
  return [...found.values()];
}

export async function tgSendMessage(token: string, chatId: string, text: string) {
  return tg<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
}

export async function tgGetChat(token: string, chatId: string) {
  return tg<TgChat>(token, "getChat", { chat_id: chatId });
}
