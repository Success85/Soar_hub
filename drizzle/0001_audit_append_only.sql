-- Audit trail is append-only: no role (including application admins) may UPDATE, DELETE or TRUNCATE.
CREATE OR REPLACE FUNCTION soar_block_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% blocked)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION soar_block_audit_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION soar_block_audit_mutation();
--> statement-breakpoint
-- Document versions are immutable once written (never silently overwrite a version's file).
CREATE OR REPLACE FUNCTION soar_block_version_file_change() RETURNS trigger AS $$
BEGIN
  IF NEW.storage_key <> OLD.storage_key OR NEW.sha256 <> OLD.sha256 OR NEW.version_number <> OLD.version_number OR NEW.document_id <> OLD.document_id THEN
    RAISE EXCEPTION 'document_versions file fields are immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_versions_immutable ON document_versions;
--> statement-breakpoint
CREATE TRIGGER document_versions_immutable BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION soar_block_version_file_change();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION soar_block_version_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'document_versions cannot be deleted' USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_versions_no_delete ON document_versions;
--> statement-breakpoint
CREATE TRIGGER document_versions_no_delete BEFORE DELETE ON document_versions FOR EACH ROW EXECUTE FUNCTION soar_block_version_delete();
