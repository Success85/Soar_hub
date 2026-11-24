-- Defence in depth for Supabase: enable Row Level Security on every application table with NO policies.
-- The application connects as the table owner, which bypasses RLS (FORCE is not set), so app behaviour is
-- unchanged; Supabase's public Data API roles (anon, authenticated) are denied all access.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
