import type {
  WhatsAppGroupDto,
  WhatsAppQueueItemDto,
  WhatsAppConnectionDto,
  ValidationResult,
  SendResult,
} from "./types";
import { defaultWhatsAppWebProvider } from "./providers/WhatsAppWebProvider";

export interface OfferToPublish {
  id?: string;
  title: string;
  score: number;
  discountPct: number;
  marketplace: string;
  category?: string;
  price: number;
  available?: boolean;
}

export class WhatsAppPublisher {
  /**
   * Executa a validação rigorosa em 11 etapas antes de permitir o disparo.
   */
  static validate(params: {
    connection: WhatsAppConnectionDto | null;
    group: WhatsAppGroupDto;
    offer?: OfferToPublish | null;
    duplicateWindowHours?: number;
    todaySentCount?: number;
    lastSentAt?: string | null;
    recentPublishedOfferIds?: string[];
  }): ValidationResult {
    const {
      connection,
      group,
      offer,
      todaySentCount = 0,
      lastSentAt,
      recentPublishedOfferIds = [],
    } = params;

    // 1. Verificação de Conexão Existente
    if (!connection) {
      return { canSend: false, reason: "Nenhuma conexão de WhatsApp vinculada." };
    }

    // 2. Status da Conexão Ativo
    if (connection.status !== "connected") {
      return {
        canSend: false,
        reason: `WhatsApp desconectado (status atual: ${connection.status}). Publicação pausada.`,
      };
    }

    // 3. Grupo Ativo
    if (!group.is_active) {
      return { canSend: false, reason: `Grupo "${group.name}" está inativo.` };
    }

    // 4. Grupo Selecionado para Automação
    if (!group.is_selected) {
      return {
        canSend: false,
        reason: `Grupo "${group.name}" não está marcado para receber publicações automáticas.`,
      };
    }

    // 5. Janela de Horário Permitida (ex: 08:00 às 22:00)
    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;

    if (
      group.allowed_start_time &&
      group.allowed_end_time &&
      (currentHourMin < group.allowed_start_time || currentHourMin > group.allowed_end_time)
    ) {
      return {
        canSend: false,
        reason: `Fora da janela de horário permitida (${group.allowed_start_time} às ${group.allowed_end_time}). Atual: ${currentHourMin}.`,
      };
    }

    // 6. Limite Diário do Grupo
    if (todaySentCount >= group.daily_limit) {
      return {
        canSend: false,
        reason: `Limite diário de ${group.daily_limit} publicações atingido para este grupo hoje.`,
      };
    }

    // 7. Intervalo Mínimo Entre Envios (Anti-flood)
    if (lastSentAt && group.posting_interval_minutes > 0) {
      const lastSentTime = new Date(lastSentAt).getTime();
      const diffMinutes = (Date.now() - lastSentTime) / (1000 * 60);
      if (diffMinutes < group.posting_interval_minutes) {
        const remaining = Math.ceil(group.posting_interval_minutes - diffMinutes);
        return {
          canSend: false,
          reason: `Intervalo mínimo não atingido. Aguarde mais ${remaining} minuto(s).`,
        };
      }
    }

    // Se houver oferta associada, valida as regras de produto:
    if (offer) {
      // 8. Validade / Disponibilidade da Oferta
      if (offer.available === false) {
        return { canSend: false, reason: "Oferta esgotada ou produto indisponível na loja." };
      }

      // 9. Score Mínimo Exigido pelo Grupo
      if (offer.score < group.minimum_offer_score) {
        return {
          canSend: false,
          reason: `Score da oferta (${offer.score}) inferior ao mínimo exigido pelo grupo (${group.minimum_offer_score}).`,
        };
      }

      // 10. Desconto Mínimo Exigido pelo Grupo
      if (offer.discountPct < group.minimum_discount) {
        return {
          canSend: false,
          reason: `Desconto da oferta (${offer.discountPct}%) inferior ao mínimo configurado (${group.minimum_discount}%).`,
        };
      }

      // 11. Controle Anti-Duplicidade
      if (offer.id && recentPublishedOfferIds.includes(offer.id)) {
        return {
          canSend: false,
          reason: `Oferta já publicada neste grupo dentro da janela de proteção anti-duplicidade.`,
        };
      }
    }

    return { canSend: true };
  }

  /**
   * Envia uma mensagem validada para o grupo do WhatsApp.
   */
  static async publishMessage(params: {
    sessionIdentifier: string;
    targetGroupId: string;
    message: string;
    mediaUrl?: string | null;
  }): Promise<SendResult> {
    const { sessionIdentifier, targetGroupId, message, mediaUrl } = params;

    if (mediaUrl) {
      return defaultWhatsAppWebProvider.sendMedia(
        sessionIdentifier,
        targetGroupId,
        mediaUrl,
        message,
      );
    }

    return defaultWhatsAppWebProvider.sendMessage(
      sessionIdentifier,
      targetGroupId,
      message,
    );
  }
}
