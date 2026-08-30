-- WhatsApp core tables batch
BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'whatsapp_web',
  session_identifier text NOT NULL UNIQUE,
  phone_number text,
  display_name text,
  status text NOT NULL DEFAULT 'waiting_qr',
  qr_code text,
  connected_at timestamptz,
  last_seen_at timestamptz,
  disconnected_at timestamptz,
  api_url text,
  api_key text,
  instance_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  external_group_id text NOT NULL,
  name text NOT NULL,
  description text,
  participant_count int NOT NULL DEFAULT 0,
  image_url text,
  category_id text DEFAULT 'geral',
  is_selected boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  daily_limit int NOT NULL DEFAULT 10,
  minimum_offer_score int NOT NULL DEFAULT 80,
  minimum_discount int NOT NULL DEFAULT 30,
  allowed_start_time text NOT NULL DEFAULT '08:00',
  allowed_end_time text NOT NULL DEFAULT '22:00',
  posting_interval_minutes int NOT NULL DEFAULT 30,
  allowed_marketplaces text[] NOT NULL DEFAULT '{"shopee","mercadolivre","amazon","shein"}',
  allowed_categories text[] NOT NULL DEFAULT '{"casa","beleza","eletronicos","moda","esportes"}',
  copy_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE (user_id, external_group_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_publication_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  group_id uuid NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  offer_id text,
  message text NOT NULL,
  media_url text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  group_name text,
  offer_title text,
  status text NOT NULL,
  reason text,
  attempt int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  duplicate_window_hours int NOT NULL DEFAULT 24,
  global_daily_limit int NOT NULL DEFAULT 50,
  global_min_interval_minutes int NOT NULL DEFAULT 15,
  pause_on_disconnect boolean NOT NULL DEFAULT true,
  default_api_url text,
  default_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_connections TO authenticated;
GRANT ALL ON public.whatsapp_connections TO service_role;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "whatsapp_connections_select" ON public.whatsapp_connections FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "whatsapp_connections_insert" ON public.whatsapp_connections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "whatsapp_connections_update" ON public.whatsapp_connections FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "whatsapp_connections_delete" ON public.whatsapp_connections FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_groups TO authenticated;
GRANT ALL ON public.whatsapp_groups TO service_role;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "whatsapp_groups_select" ON public.whatsapp_groups FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "whatsapp_groups_insert" ON public.whatsapp_groups FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "whatsapp_groups_update" ON public.whatsapp_groups FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "whatsapp_groups_delete" ON public.whatsapp_groups FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_publication_queue TO authenticated;
GRANT ALL ON public.whatsapp_publication_queue TO service_role;
ALTER TABLE public.whatsapp_publication_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "whatsapp_publication_queue_select" ON public.whatsapp_publication_queue FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "whatsapp_publication_queue_insert" ON public.whatsapp_publication_queue FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "whatsapp_publication_queue_update" ON public.whatsapp_publication_queue FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "whatsapp_publication_queue_delete" ON public.whatsapp_publication_queue FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_logs TO authenticated;
GRANT ALL ON public.whatsapp_logs TO service_role;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "whatsapp_logs_select" ON public.whatsapp_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "whatsapp_logs_insert" ON public.whatsapp_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "whatsapp_logs_update" ON public.whatsapp_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "whatsapp_logs_delete" ON public.whatsapp_logs FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_settings TO authenticated;
GRANT ALL ON public.whatsapp_settings TO service_role;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "whatsapp_settings_owner" ON public.whatsapp_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE t text;
DECLARE tables_to_trigger text[] := ARRAY['whatsapp_connections','whatsapp_groups','whatsapp_publication_queue','whatsapp_settings'];
BEGIN
  FOREACH t IN ARRAY tables_to_trigger LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        t||'_updated_at', t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

COMMIT;
