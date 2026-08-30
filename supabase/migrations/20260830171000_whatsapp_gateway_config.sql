-- =========================================================
-- MIGRATION: WHATSAPP GATEWAY REAL INTEGRATION CONFIG
-- Adiciona suporte a credenciais e endpoints de Gateway Real
-- =========================================================

ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS api_url text,
  ADD COLUMN IF NOT EXISTS api_key text,
  ADD COLUMN IF NOT EXISTS instance_name text;

ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS default_api_url text,
  ADD COLUMN IF NOT EXISTS default_api_key text;
