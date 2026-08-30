/**
 * RetryEngine — Gerencia re-tentativas inteligentes com backoff exponencial.
 *
 * Regras:
 * - Máximo de 3 tentativas por item
 * - Backoff: 1min → 5min → 15min
 * - Nunca entra em loop infinito
 * - Após 3 falhas, marca como FAILED definitivo
 */

export interface RetryConfig {
  maxAttempts: number;
  backoffMinutes: number[]; // intervalo em minutos para cada tentativa
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoffMinutes: [1, 5, 15],
};

export interface RetryDecision {
  shouldRetry: boolean;
  nextAttempt: number;
  nextRetryAt: Date | null;
  isFinalFailure: boolean;
  reason: string;
}

export function computeRetryDecision(
  currentAttempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): RetryDecision {
  if (currentAttempt >= config.maxAttempts) {
    return {
      shouldRetry: false,
      nextAttempt: currentAttempt,
      nextRetryAt: null,
      isFinalFailure: true,
      reason: `Máximo de tentativas atingido (${config.maxAttempts}). Item marcado como FALHA DEFINITIVA.`,
    };
  }

  const waitMinutes = config.backoffMinutes[currentAttempt] ?? config.backoffMinutes[config.backoffMinutes.length - 1] ?? 15;
  const nextRetryAt = new Date(Date.now() + waitMinutes * 60 * 1000);

  return {
    shouldRetry: true,
    nextAttempt: currentAttempt + 1,
    nextRetryAt,
    isFinalFailure: false,
    reason: `Tentativa ${currentAttempt + 1}/${config.maxAttempts}. Próxima tentativa em ${waitMinutes} minuto(s).`,
  };
}

/**
 * Retorna label legível para o status de retry.
 */
export function retryStatusLabel(attempt: number, maxAttempts: number): string {
  if (attempt === 0) return "Aguardando primeira tentativa";
  if (attempt >= maxAttempts) return `Falha após ${maxAttempts} tentativas`;
  return `Tentativa ${attempt} de ${maxAttempts}`;
}
