ALTER TABLE "users" ADD COLUMN "member_code" varchar(20);--> statement-breakpoint
CREATE UNIQUE INDEX "users_member_code_uq" ON "users" USING btree ("member_code");--> statement-breakpoint
-- Backfill: every already-verified member gets a member ID (SOAR-YY-XXXXXX, no look-alike characters).
DO $$
DECLARE
  r record;
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text;
  i int;
BEGIN
  FOR r IN SELECT id, email_verified_at FROM users WHERE email_verified_at IS NOT NULL AND member_code IS NULL LOOP
    LOOP
      code := 'SOAR-' || to_char(r.email_verified_at AT TIME ZONE 'UTC', 'YY') || '-';
      FOR i IN 1..6 LOOP
        code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE member_code = code);
    END LOOP;
    UPDATE users SET member_code = code WHERE id = r.id;
  END LOOP;
END $$;
