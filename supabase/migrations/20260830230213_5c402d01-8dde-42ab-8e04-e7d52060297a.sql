-- Batch 3: automation and operational tables
BEGIN;

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  offers_evaluated int NOT NULL DEFAULT 0,
  offers_published int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_auto ON public.automation_runs(automation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user ON public.automation_runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.system_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sys_notif_user_read ON public.system_notifications(user_id, read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.channel_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'healthy',
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  failure_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_health_user ON public.channel_health(user_id, channel);

CREATE TABLE IF NOT EXISTS public.retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  publication_id uuid REFERENCES public.publications(id) ON DELETE CASCADE,
  queue_id uuid REFERENCES public.publication_queue(id) ON DELETE CASCADE,
  channel text NOT NULL,
  destination_id text NOT NULL,
  payload jsonb NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retry_queue_next ON public.retry_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_retry_queue_user ON public.retry_queue(user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "automation_runs_select" ON public.automation_runs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "automation_runs_insert" ON public.automation_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "automation_runs_update" ON public.automation_runs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "automation_runs_delete" ON public.automation_runs FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_notifications TO authenticated;
GRANT ALL ON public.system_notifications TO service_role;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "system_notifications_select" ON public.system_notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "system_notifications_insert" ON public.system_notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "system_notifications_update" ON public.system_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "system_notifications_delete" ON public.system_notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_health TO authenticated;
GRANT ALL ON public.channel_health TO service_role;
ALTER TABLE public.channel_health ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "channel_health_select" ON public.channel_health FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "channel_health_insert" ON public.channel_health FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "channel_health_update" ON public.channel_health FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "channel_health_delete" ON public.channel_health FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retry_queue TO authenticated;
GRANT ALL ON public.retry_queue TO service_role;
ALTER TABLE public.retry_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "retry_queue_select" ON public.retry_queue FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "retry_queue_insert" ON public.retry_queue FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "retry_queue_update" ON public.retry_queue FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "retry_queue_delete" ON public.retry_queue FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE t text;
DECLARE tables_to_trigger text[] := ARRAY['channel_health','retry_queue'];
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
