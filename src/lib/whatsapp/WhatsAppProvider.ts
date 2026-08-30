/**
 * IWhatsAppProvider — Interface conceitual do conector de WhatsApp.
 *
 * Permite substituir a integração subjacente (Evolution API, WAHA,
 * Z-Api, Baileys Gateway ou API Oficial Cloud) sem alterar a lógica
 * de negócios ou as telas do SaaS.
 */

import type {
  ConnectionResult,
  WhatsAppConnectionStatus,
  SendResult,
  WhatsAppGatewayCredentials,
} from "./types";

export interface IWhatsAppProvider {
  /** Inicia ou recupera a sessão e obtém o QR code real do servidor. */
  connect(
    sessionIdentifier: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<ConnectionResult>;

  /** Encerra a sessão com segurança e desconecta do WhatsApp. */
  disconnect(
    sessionIdentifier: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<void>;

  /** Consulta o status atual da conexão em tempo real no servidor. */
  getConnectionStatus(
    sessionIdentifier: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<{
    status: WhatsAppConnectionStatus;
    phoneNumber?: string | null;
    displayName?: string | null;
    qrCode?: string | null;
  }>;

  /** Busca todos os grupos REAIS onde o número autenticado participa. */
  getGroups(
    sessionIdentifier: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<
    Array<{
      externalGroupId: string;
      name: string;
      description?: string | null;
      participantCount: number;
      imageUrl?: string | null;
    }>
  >;

  /** Envia mensagem de texto real para um grupo específico. */
  sendMessage(
    sessionIdentifier: string,
    toJid: string,
    text: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<SendResult>;

  /** Envia mídia (imagem/vídeo) com legenda para um grupo específico. */
  sendMedia(
    sessionIdentifier: string,
    toJid: string,
    mediaUrl: string,
    caption?: string,
    credentials?: WhatsAppGatewayCredentials,
  ): Promise<SendResult>;
}
