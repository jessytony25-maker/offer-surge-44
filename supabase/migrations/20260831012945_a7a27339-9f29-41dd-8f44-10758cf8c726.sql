GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO authenticated;
GRANT ALL ON public.integration_credentials TO service_role;

CREATE POLICY "integration_credentials_select" ON public.integration_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "integration_credentials_insert" ON public.integration_credentials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "integration_credentials_update" ON public.integration_credentials
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "integration_credentials_delete" ON public.integration_credentials
  FOR DELETE TO authenticated USING (auth.uid() = user_id);