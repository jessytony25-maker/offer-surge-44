/**
 * AntiSpamEngine — Motor de proteção anti-flood e anti-duplicidade.
 *
 * Verifica todas as condições ANTES de qualquer publicação.
 * Registra motivo claro quando bloqueia.
 */

export interface AntiSpamRules {
  maxPerHour: number;
  maxPerDay: number;
  minIntervalMinutes: number;
  duplicateWindowHours: number;
  enabled: boolean;
}

export const DEFAULT_ANTI_SPAM_RULES: AntiSpamRules = {
  maxPerHour: 20,
  maxPerDay: 100,
  minIntervalMinutes: 10,
  duplicateWindowHours: 24,
  enabled: true,
};

export interface AntiSpamCheckInput {
  groupId: string;
  offerId?: string | null;
  offerTitle?: string;
  sentInLastHour: number;
  sentToday: number;
  lastSentAt?: string | null;
  recentOfferIds: string[]; // IDs publicados no grupo dentro da janela de duplicidade
  rules: AntiSpamRules;
}

export interface AntiSpamResult {
  canPublish: boolean;
  reason?: string;
  cooldownUntil?: Date;
  riskLevel: "none" | "low" | "medium" | "high" | "blocked";
}

export function checkAntiSpam(input: AntiSpamCheckInput): AntiSpamResult {
  const { rules, sentInLastHour, sentToday, lastSentAt, offerId, recentOfferIds } = input;

  if (!rules.enabled) {
    return { canPublish: true, riskLevel: "none" };
  }

  // 1. Limite por hora
  if (sentInLastHour >= rules.maxPerHour) {
    return {
      canPublish: false,
      reason: `Limite horário atingido (${sentInLastHour}/${rules.maxPerHour} por hora). Aguarde para continuar.`,
      riskLevel: "blocked",
    };
  }

  // 2. Limite diário
  if (sentToday >= rules.maxPerDay) {
    return {
      canPublish: false,
      reason: `Limite diário atingido (${sentToday}/${rules.maxPerDay}). Publicações serão retomadas amanhã.`,
      riskLevel: "blocked",
    };
  }

  // 3. Intervalo mínimo entre envios
  if (lastSentAt && rules.minIntervalMinutes > 0) {
    const lastMs = new Date(lastSentAt).getTime();
    const diffMin = (Date.now() - lastMs) / (1000 * 60);
    if (diffMin < rules.minIntervalMinutes) {
      const remaining = Math.ceil(rules.minIntervalMinutes - diffMin);
      const cooldownUntil = new Date(lastMs + rules.minIntervalMinutes * 60 * 1000);
      return {
        canPublish: false,
        reason: `Intervalo mínimo não atingido. Aguarde ${remaining} minuto(s) antes do próximo envio.`,
        cooldownUntil,
        riskLevel: "medium",
      };
    }
  }

  // 4. Anti-duplicidade: mesma oferta no mesmo grupo dentro da janela
  if (offerId && recentOfferIds.includes(offerId)) {
    return {
      canPublish: false,
      reason: `Oferta já publicada neste grupo nos últimos ${rules.duplicateWindowHours}h. Proteção anti-duplicidade ativa.`,
      riskLevel: "blocked",
    };
  }

  // Aviso de proximidade do limite
  const hourRisk = sentInLastHour / rules.maxPerHour;
  const dayRisk = sentToday / rules.maxPerDay;

  let riskLevel: AntiSpamResult["riskLevel"] = "none";
  if (hourRisk >= 0.9 || dayRisk >= 0.9) riskLevel = "high";
  else if (hourRisk >= 0.7 || dayRisk >= 0.7) riskLevel = "medium";
  else if (hourRisk >= 0.5 || dayRisk >= 0.5) riskLevel = "low";

  return { canPublish: true, riskLevel };
}

/**
 * Verifica se o horário atual está dentro da janela permitida.
 */
export function isWithinTimeWindow(startTime: string, endTime: string): boolean {
  const now = new Date();
  const currentHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return currentHM >= startTime && currentHM <= endTime;
}

/**
 * Calcula o próximo horário de envio dado o intervalo mínimo.
 */
export function nextAllowedSendTime(lastSentAt: string, intervalMinutes: number): Date {
  return new Date(new Date(lastSentAt).getTime() + intervalMinutes * 60 * 1000);
}
