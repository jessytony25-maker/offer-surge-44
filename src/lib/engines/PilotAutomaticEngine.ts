/**
 * PilotAutomaticEngine — Gerencia o estado e as regras do Piloto Automático.
 *
 * Estados: OFF → ON → PAUSADO → ERRO → ON
 * Botão de emergência: ⛔ para tudo imediatamente.
 *
 * Nota: A execução real do pipeline requer um job agendado (Supabase Edge
 * Function ou equivalente). Este módulo gerencia a lógica de estado
 * e as verificações de segurança.
 */

export type PilotStatus = "off" | "on" | "paused" | "error";
export type OperationMode = "manual" | "semi_auto" | "pilot";

export interface PilotConfig {
  status: PilotStatus;
  mode: OperationMode;
  emergencyStop: boolean;
  globalDailyLimit: number;
  globalHourlyLimit: number;
  globalMinIntervalMinutes: number;
  globalMinScore: number;
  duplicateWindowHours: number;
  antiSpamEnabled: boolean;
}

export const DEFAULT_PILOT_CONFIG: PilotConfig = {
  status: "off",
  mode: "manual",
  emergencyStop: false,
  globalDailyLimit: 100,
  globalHourlyLimit: 20,
  globalMinIntervalMinutes: 10,
  globalMinScore: 60,
  duplicateWindowHours: 24,
  antiSpamEnabled: true,
};

export interface PilotStateChange {
  fromStatus: PilotStatus;
  toStatus: PilotStatus;
  reason: string;
  allowedAt: string;
}

export function canActivatePilot(config: PilotConfig): { allowed: boolean; reason?: string } {
  if (config.emergencyStop) {
    return { allowed: false, reason: "⛔ Parada de emergência ativa. Desative primeiro." };
  }
  if (config.status === "error") {
    return { allowed: false, reason: "Sistema com erro. Verifique os logs antes de reativar." };
  }
  return { allowed: true };
}

export function computePilotTransition(
  current: PilotStatus,
  action: "activate" | "pause" | "stop" | "emergency_stop" | "recover",
  config: PilotConfig,
): PilotStateChange {
  const now = new Date().toISOString();

  switch (action) {
    case "activate":
      if (config.emergencyStop) {
        return { fromStatus: current, toStatus: "paused", reason: "Emergência ativa — ativação bloqueada.", allowedAt: now };
      }
      return { fromStatus: current, toStatus: "on", reason: "Piloto Automático ativado pelo usuário.", allowedAt: now };

    case "pause":
      return { fromStatus: current, toStatus: "paused", reason: "Piloto Automático pausado pelo usuário.", allowedAt: now };

    case "stop":
      return { fromStatus: current, toStatus: "off", reason: "Piloto Automático desligado.", allowedAt: now };

    case "emergency_stop":
      return {
        fromStatus: current,
        toStatus: "paused",
        reason: "⛔ PARADA DE EMERGÊNCIA: todas as publicações interrompidas. Histórico preservado.",
        allowedAt: now,
      };

    case "recover":
      return { fromStatus: current, toStatus: "off", reason: "Erro resolvido. Sistema pronto para reativação.", allowedAt: now };

    default:
      return { fromStatus: current, toStatus: current, reason: "Ação inválida.", allowedAt: now };
  }
}

export const PILOT_STATUS_CONFIG: Record<
  PilotStatus,
  { label: string; color: string; badgeClass: string; icon: string }
> = {
  off: {
    label: "Desligado",
    color: "text-muted-foreground",
    badgeClass: "border-border bg-muted text-muted-foreground",
    icon: "⚫",
  },
  on: {
    label: "Ativo",
    color: "text-emerald-500",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    icon: "🤖",
  },
  paused: {
    label: "Pausado",
    color: "text-amber-500",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    icon: "⏸",
  },
  error: {
    label: "Erro",
    color: "text-destructive",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: "⚠️",
  },
};

export const OPERATION_MODE_CONFIG: Record<
  OperationMode,
  { label: string; description: string; icon: string }
> = {
  manual: {
    label: "Manual",
    description: "O sistema encontra ofertas e você aprova cada uma.",
    icon: "✋",
  },
  semi_auto: {
    label: "Semi-Automático",
    description: "O sistema aprova automaticamente conforme as regras configuradas.",
    icon: "⚙️",
  },
  pilot: {
    label: "Piloto Automático",
    description: "O sistema executa todo o fluxo automaticamente respeitando suas regras.",
    icon: "🤖",
  },
};
