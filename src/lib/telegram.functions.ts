import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Status do bot + link/QR para adicionar em grupos e canais. */
export const telegramBotStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCredentials } = await import("@/lib/credentials.server");
    const { tgGetMe } = await import("@/lib/telegram.server");
    const creds = await getCredentials(context.userId, "channel", "telegram");
    const token = creds["bot_token"];
    if (!token) {
      return { connected: false as const, message: "Bot Token não configurado." };
    }
    const me = await tgGetMe(token);
    if (!me.ok || !me.result?.username) {
      return { connected: false as const, message: me.description ?? "Bot Token inválido." };
    }
    const username = me.result.username;
    return {
      connected: true as const,
      username,
      addToGroupUrl: `https://t.me/${username}?startgroup=true`,
      addToChannelUrl: `https://t.me/${username}?startchannel=true`,
      botUrl: `https://t.me/${username}`,
    };
  });

/** Importa para `groups` todos os chats onde o bot já foi adicionado. */
export const syncTelegramGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCredentials } = await import("@/lib/credentials.server");
    const { tgDiscoverChats } = await import("@/lib/telegram.server");
    const creds = await getCredentials(context.userId, "channel", "telegram");
    const token = creds["bot_token"];
    if (!token) throw new Error("Conecte o Telegram em Integrações antes de sincronizar.");

    const chats = await tgDiscoverChats(token);
    if (chats.length === 0) {
      return { imported: 0, updated: 0, found: 0 };
    }

    const { data: existing } = await context.supabase
      .from("groups")
      .select("id, identifier")
      .eq("platform", "telegram");
    const byIdentifier = new Map((existing ?? []).map((g) => [g.identifier, g.id]));

    let imported = 0;
    let updated = 0;
    for (const chat of chats) {
      const identifier = String(chat.id);
      const name = chat.title ?? chat.username ?? identifier;
      const current = byIdentifier.get(identifier);
      if (current) {
        await context.supabase
          .from("groups")
          .update({ name, status: "connected" })
          .eq("id", current);
        updated += 1;
      } else {
        const { error } = await context.supabase.from("groups").insert({
          user_id: context.userId,
          name,
          identifier,
          platform: "telegram",
          status: "connected",
          category: chat.type,
        });
        if (!error) imported += 1;
      }
    }
    return { imported, updated, found: chats.length };
  });

/** Envio real de uma mensagem para um grupo/canal do Telegram. */
export const sendTelegramMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ groupId: z.string().uuid(), text: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getCredentials } = await import("@/lib/credentials.server");
    const { tgSendMessage } = await import("@/lib/telegram.server");
    const creds = await getCredentials(context.userId, "channel", "telegram");
    const token = creds["bot_token"];
    if (!token) throw new Error("Conecte o Telegram em Integrações.");

    const { data: group } = await context.supabase
      .from("groups")
      .select("id, identifier, platform, name")
      .eq("id", data.groupId)
      .maybeSingle();
    if (!group || group.platform !== "telegram" || !group.identifier) {
      throw new Error("Grupo do Telegram inválido ou sem identificador.");
    }

    const sent = await tgSendMessage(token, group.identifier, data.text);
    if (!sent.ok) {
      return { ok: false as const, message: sent.description ?? "Telegram recusou o envio." };
    }
    return { ok: true as const, message: `Mensagem publicada em ${group.name}.` };
  });
