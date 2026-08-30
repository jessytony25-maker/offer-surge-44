/**
 * Tipos e interfaces do módulo WhatsApp Connector.
 */

export type WhatsAppConnectionStatus =
  | "waiting_qr"
  | "qr_ready"
  | "waiting_scan"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type WhatsAppQueueStatus =
  | "pending"
  | "scheduled"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export interface WhatsAppConnectionDto {
  id: string;
  user_id: string;
  provider: "whatsapp_web" | "evolution_api" | "official_cloud" | "custom";
  session_identifier: string;
  phone_number?: string | null;
  display_name?: string | null;
  status: WhatsAppConnectionStatus;
  qr_code?: string | null;
  connected_at?: string | null;
  last_seen_at?: string | null;
  disconnected_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppGroupDto {
  id: string;
  user_id: string;
  connection_id: string;
  external_group_id: string;
  name: string;
  description?: string | null;
  participant_count: number;
  image_url?: string | null;
  category_id?: string | null;
  is_selected: boolean;
  is_active: boolean;
  daily_limit: number;
  minimum_offer_score: number;
  minimum_discount: number;
  allowed_start_time: string;
  allowed_end_time: string;
  posting_interval_minutes: number;
  allowed_marketplaces: string[];
  allowed_categories: string[];
  copy_template?: string | null;
  last_synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppQueueItemDto {
  id: string;
  user_id: string;
  connection_id?: string | null;
  group_id: string;
  group_name?: string;
  offer_id?: string | null;
  offer_title?: string | null;
  message: string;
  media_url?: string | null;
  scheduled_at: string;
  status: WhatsAppQueueStatus;
  attempts: number;
  last_error?: string | null;
  sent_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppLogDto {
  id: string;
  user_id: string;
  connection_id?: string | null;
  group_name: string;
  offer_title: string;
  status: "sent" | "failed" | "skipped";
  reason?: string | null;
  attempt: number;
  created_at: string;
}

export interface WhatsAppSettingsDto {
  user_id: string;
  duplicate_window_hours: number; // 1, 6, 12, 24, 48, 168
  global_daily_limit: number;
  global_min_interval_minutes: number;
  pause_on_disconnect: boolean;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  reason?: string;
}

export interface ValidationResult {
  canSend: boolean;
  reason?: string;
}

export interface ConnectionResult {
  status: WhatsAppConnectionStatus;
  qrCode?: string;
  sessionIdentifier: string;
  message?: string;
}
