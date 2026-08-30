/**
 * IWhatsAppProvider — Interface conceitual do conector de WhatsApp.
 *
 * Permite substituir a integração subjacente (WhatsApp Web Multi-device,
 * Evolution API, Z-Api, WppConnect ou API Oficial Cloud) sem alterar a lógica
 * de negócios ou as telas do SaaS.
 */

import type {
  ConnectionResult,
  WhatsAppConnectionStatus,
  WhatsAppGroupDto,
  SendResult,
} from "./types";

export interface IWhatsAppProvider {
  /** Inicia ou recupera a sessão e gera o QR code caso necessário. */
  connect(sessionIdentifier: string): Promise<ConnectionResult>;

  /** Encerra a sessão com segurança e desconecta do WhatsApp. */
  disconnect(sessionIdentifier: string): Promise<void>;

  /** Consulta o status atual da conexão em tempo real. */
  getConnectionStatus(sessionIdentifier: string): Promise<{
    status: WhatsAppConnectionStatus;
    phoneNumber?: string | null;
    displayName?: string | null;
    qrCode?: string | null;
  }>;

  /** Busca todos os grupos onde o número autenticado é participante ou admin. */
  getGroups(sessionIdentifier: string): Promise<
    Array<{
      externalGroupId: string;
      name: string;
      description?: string | null;
      participantCount: number;
      imageUrl?: string | null;
    }>
  >;

  /** Envia mensagem de texto para um grupo específico. */
  sendMessage(
    sessionIdentifier: string,
    toJid: string,
    text: string,
  ): Promise<SendResult>;

  /** Envia mídia (imagem/vídeo) com legenda para um grupo específico. */
  sendMedia(
    sessionIdentifier: string,
    toJid: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<SendResult>;
}
