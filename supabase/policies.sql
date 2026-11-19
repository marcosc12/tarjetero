ALTER TABLE public.tarjetas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tarjetas'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.tarjetas', existing_policy.policyname);
  END LOOP;
END;
$$;

GRANT SELECT ON TABLE public.tarjetas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.tarjetas TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.tarjetas FROM anon;

CREATE POLICY "tarjetas_public_read"
ON public.tarjetas
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "tarjetas_authenticated_manage"
ON public.tarjetas
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
