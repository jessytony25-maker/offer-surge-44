/**
 * Motor REAL de automações.
 *
 * Regras: só publica ofertas reais existentes no banco, respeitando filtros,
 * janela de horário, limite diário, intervalo mínimo e anti-duplicidade.
 * Telegram → envio imediato pela Bot API oficial.
 * WhatsApp → entra na fila de publicação (fluxo do módulo WhatsApp).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AutomationConfig {
  trigger_type: "new_offer" | "price_drop" | "scheduled" | "top_sellers";
  trigger_interval?: string;
  min_score: number;
  min_discount: number;
  min_price: number;
  max_price: number;
  min_commission: number;
  marketplaces: string[];
  categories: string[];
  blocked_words: string;
  only_free_shipping: boolean;
  only_with_coupon: boolean;
  group_ids: string[];
  copy_template_id: string;
  custom_copy: string;
  interval_minutes: number;
  daily_limit: number;
  start_hour: string;
  end_hour: string;
  active_days: string[];
  action_mode: "auto_publish" | "queue_for_review";
  duplicate_window_hours?: number;
}

export const DEFAULT_CONFIG: AutomationConfig = {
  trigger_type: "new_offer",
  min_score: 70,
  min_discount: 20,
  min_price: 10,
  max_price: 5000,
  min_commission: 0,
  marketplaces: [],
  categories: [],
  blocked_words: "",
  only_free_shipping: false,
  only_with_coupon: false,
  group_ids: [],
  copy_template_id: "direct",
  custom_copy:
    "⚡ <b>{titulo}</b>\n\n💰 <b>{preco_por}</b> (era {preco_de})\n🏷️ {desconto}% OFF\n🏬 {loja}\n\n🔗 {link}",
  interval_minutes: 15,
  daily_limit: 20,
  start_hour: "08:00",
  end_hour: "22:00",
  active_days: ["seg", "ter", "qua", "qui", "sex", "sab", "dom"],
  action_mode: "auto_publish",
  duplicate_window_hours: 24,
};

const TZ = "America/Sao_Paulo";
const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

export function nowInTz(): { hhmm: string; day: string; date: Date } {
  const date = new Date();
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const jsDay = new Date(date.toLocaleString("en-US", { timeZone: TZ })).getDay();
  return { hhmm: `${hour}:${minute}`, day: DAY_KEYS[jsDay] ?? "seg", date };
}

function brl(value: number | null | undefined) {
  if (value == null) return "";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface OfferRow {
  id: string;
  title: string;
  price: number;
  previous_price: number | null;
  discount_pct: number;
  marketplace: string;
  score: number;
  coupon: string | null;
  free_shipping: boolean;
  affiliate_url: string | null;
  original_url: string | null;
  category: string | null;
  rating: number | null;
  commission_pct: number | null;
  image_url: string | null;
}

export function renderCopy(template: string, offer: OfferRow) {
  const link = offer.affiliate_url || offer.original_url || "";
  return template
    .replace(/\{titulo\}/g, offer.title)
    .replace(/\{preco_de\}/g, brl(offer.previous_price))
    .replace(/\{preco_por\}/g, brl(offer.price))
    .replace(/\{preco\}/g, brl(offer.price))
    .replace(/\{desconto\}/g, String(offer.discount_pct ?? 0))
    .replace(/\{loja\}/g, offer.marketplace)
    .replace(/\{score\}/g, String(offer.score ?? 0))
    .replace(/\{cupom\}/g, offer.coupon ?? "")
    .replace(/\{frete\}/g, offer.free_shipping ? "Frete Grátis" : "")
    .replace(/\{avaliacao\}/g, offer.rating ? String(offer.rating) : "")
    .replace(/\{parcelamento\}/g, "")
    .replace(/\{link\}/g, link)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface RunResult {
  ok: boolean;
  automationId: string;
  evaluated: number;
  published: number;
  queued: number;
  errors: number;
  skipped: string[];
  message: string;
}

export async function runAutomation(
  supabase: SupabaseClient,
  userId: string,
  automationId: string,
  options: { ignoreWindow?: boolean } = {},
): Promise<RunResult> {
  const base: RunResult = {
    ok: false,
    automationId,
    evaluated: 0,
    published: 0,
    queued: 0,
    errors: 0,
    skipped: [],
    message: "",
  };

  const { data: automation } = await supabase
    .from("automations")
    .select("id, name, active, config, template_id")
    .eq("id", automationId)
    .maybeSingle();

  if (!automation) return { ...base, message: "Automação não encontrada." };

  const cfg: AutomationConfig = {
    ...DEFAULT_CONFIG,
    ...((automation.config ?? {}) as Partial<AutomationConfig>),
  };

  const startedAt = new Date().toISOString();
  const { data: run } = await supabase
    .from("automation_runs")
    .insert({
      user_id: userId,
      automation_id: automationId,
      started_at: startedAt,
      status: "running",
    })
    .select("id")
    .maybeSingle();

  const finish = async (result: RunResult) => {
    if (run?.id) {
      await supabase
        .from("automation_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: result.errors > 0 ? "error" : "success",
          offers_evaluated: result.evaluated,
          offers_published: result.published + result.queued,
          errors: result.errors,
          last_error: result.errors > 0 ? result.message : null,
        })
        .eq("id", run.id);
    }
    await supabase
      .from("automations")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", automationId);
    return result;
  };

  // 1. Janela de horário e dia da semana
  const { hhmm, day } = nowInTz();
  if (!options.ignoreWindow) {
    if (!cfg.active_days.includes(day)) {
      return finish({ ...base, ok: true, message: `Hoje (${day}) não é um dia ativo desta regra.` });
    }
    if (hhmm < cfg.start_hour || hhmm > cfg.end_hour) {
      return finish({
        ...base,
        ok: true,
        message: `Fora da janela permitida (${cfg.start_hour}–${cfg.end_hour}). Agora: ${hhmm}.`,
      });
    }
  }

  // 2. Grupos de destino
  let groupQuery = supabase
    .from("groups")
    .select("id, name, platform, identifier, active, status")
    .eq("user_id", userId);
  if (cfg.group_ids.length > 0) groupQuery = groupQuery.in("id", cfg.group_ids);
  const { data: allGroups } = await groupQuery;
  const groups = (allGroups ?? []).filter((g) => g.active !== false);

  if (groups.length === 0) {
    return finish({
      ...base,
      message: "Nenhum grupo de destino ativo. Conecte um grupo em Grupos ou WhatsApp.",
    });
  }

  // 3. Limite diário e intervalo mínimo (por automação)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todayPubs } = await supabase
    .from("publications")
    .select("id, offer_id, group_id, published_at")
    .eq("user_id", userId)
    .gte("published_at", todayStart.toISOString())
    .order("published_at", { ascending: false });

  const groupIds = new Set(groups.map((g) => g.id));
  const scoped = (todayPubs ?? []).filter((p) => p.group_id && groupIds.has(p.group_id));
  const remaining = cfg.daily_limit - scoped.length;
  if (remaining <= 0) {
    return finish({
      ...base,
      ok: true,
      message: `Limite diário de ${cfg.daily_limit} publicações já atingido.`,
    });
  }

  if (!options.ignoreWindow && scoped[0]?.published_at && cfg.interval_minutes > 0) {
    const diffMin = (Date.now() - new Date(scoped[0].published_at).getTime()) / 60000;
    if (diffMin < cfg.interval_minutes) {
      return finish({
        ...base,
        ok: true,
        message: `Intervalo mínimo não atingido. Faltam ${Math.ceil(cfg.interval_minutes - diffMin)} min.`,
      });
    }
  }

  // 4. Ofertas reais elegíveis
  let offerQuery = supabase
    .from("offers")
    .select(
      "id, title, price, previous_price, discount_pct, marketplace, score, coupon, free_shipping, affiliate_url, original_url, category, rating, commission_pct, image_url",
    )
    .eq("user_id", userId)
    .eq("available", true)
    .in("status", ["new", "approved"])
    .gte("score", cfg.min_score)
    .gte("discount_pct", cfg.min_discount)
    .gte("price", cfg.min_price)
    .lte("price", cfg.max_price)
    .order("score", { ascending: false })
    .limit(60);

  if (cfg.marketplaces.length > 0) offerQuery = offerQuery.in("marketplace", cfg.marketplaces);
  if (cfg.only_free_shipping) offerQuery = offerQuery.eq("free_shipping", true);
  if (cfg.trigger_type === "price_drop") offerQuery = offerQuery.not("previous_price", "is", null);

  const { data: rawOffers, error: offerError } = await offerQuery;
  if (offerError) {
    return finish({ ...base, errors: 1, message: `Erro ao buscar ofertas: ${offerError.message}` });
  }

  const blocked = cfg.blocked_words
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

  const dupWindow = (cfg.duplicate_window_hours ?? 24) * 3600 * 1000;
  const { data: recentPubs } = await supabase
    .from("publications")
    .select("offer_id, group_id, published_at")
    .eq("user_id", userId)
    .gte("published_at", new Date(Date.now() - dupWindow).toISOString());
  const recentKey = new Set(
    (recentPubs ?? []).map((p) => `${p.offer_id ?? ""}:${p.group_id ?? ""}`),
  );

  const offers = ((rawOffers ?? []) as OfferRow[]).filter((o) => {
    if (cfg.categories.length > 0 && o.category && !cfg.categories.includes(o.category)) return false;
    if (cfg.only_with_coupon && !o.coupon) return false;
    if (cfg.min_commission > 0 && (o.commission_pct ?? 0) < cfg.min_commission) return false;
    const lower = o.title.toLowerCase();
    if (blocked.some((w) => lower.includes(w))) return false;
    if (!o.affiliate_url && !o.original_url) return false;
    return true;
  });

  base.evaluated = offers.length;
  if (offers.length === 0) {
    return finish({
      ...base,
      ok: true,
      message:
        "Nenhuma oferta real atende aos filtros no momento. Sincronize os marketplaces em Integrações.",
    });
  }

  // 5. Credencial real do Telegram (se houver grupo Telegram)
  let telegramToken: string | undefined;
  if (groups.some((g) => g.platform === "telegram")) {
    const { getCredentials } = await import("@/lib/credentials.server");
    const creds = await getCredentials(userId, "channel", "telegram");
    telegramToken = creds["bot_token"];
  }
  const { tgSendMessage } = await import("@/lib/telegram.server");

  let published = 0;
  let queued = 0;
  let errors = 0;
  const skipped: string[] = [];
  const template = cfg.custom_copy || DEFAULT_CONFIG.custom_copy;

  outer: for (const offer of offers) {
    for (const group of groups) {
      if (published + queued >= remaining) break outer;
      if (recentKey.has(`${offer.id}:${group.id}`)) {
        skipped.push(`${offer.title} → ${group.name}: já publicada na janela anti-duplicidade.`);
        continue;
      }

      const content = renderCopy(template, offer);
      const link = offer.affiliate_url || offer.original_url || "";
      const shouldQueue =
        cfg.action_mode === "queue_for_review" ||
        group.platform !== "telegram" ||
        !telegramToken ||
        !group.identifier;

      if (shouldQueue) {
        const { error } = await supabase.from("publication_queue").insert({
          user_id: userId,
          offer_id: offer.id,
          group_id: group.id,
          automation_id: automationId,
          template_id: automation.template_id,
          scheduled_at: new Date().toISOString(),
          status: "pending",
          content,
        });
        if (error) {
          errors += 1;
          skipped.push(`${group.name}: ${error.message}`);
        } else {
          queued += 1;
          recentKey.add(`${offer.id}:${group.id}`);
        }
        continue;
      }

      const sent = await tgSendMessage(telegramToken!, group.identifier!, content);
      await supabase.from("publications").insert({
        user_id: userId,
        offer_id: offer.id,
        group_id: group.id,
        template_id: automation.template_id,
        marketplace: offer.marketplace,
        title: offer.title,
        link,
        content,
        status: sent.ok ? "published" : "failed",
        attempts: 1,
        error: sent.ok ? null : (sent.description ?? "Falha no envio"),
        published_at: new Date().toISOString(),
      });

      if (sent.ok) {
        published += 1;
        recentKey.add(`${offer.id}:${group.id}`);
        await supabase.from("offers").update({ status: "published" }).eq("id", offer.id);
      } else {
        errors += 1;
        skipped.push(`${group.name}: ${sent.description ?? "Telegram recusou o envio."}`);
      }
    }
  }

  await supabase.from("audit_logs").insert({
    user_id: userId,
    channel: "automation",
    action: "run",
    entity: "automations",
    entity_id: automationId,
    level: errors > 0 ? "warn" : "info",
    meta: { published, queued, errors, evaluated: offers.length },
  });

  return finish({
    ...base,
    ok: true,
    published,
    queued,
    errors,
    skipped: skipped.slice(0, 10),
    message:
      published + queued === 0
        ? "Nada publicado nesta execução. Verifique os motivos listados."
        : `${published} publicação(ões) enviada(s) e ${queued} na fila.`,
  });
}
