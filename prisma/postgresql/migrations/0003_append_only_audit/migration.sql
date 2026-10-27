CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent rows are append-only';
END;
$$;

CREATE TRIGGER "AuditEvent_no_update_or_delete"
BEFORE UPDATE OR DELETE ON public."AuditEvent"
FOR EACH ROW EXECUTE FUNCTION public.reject_audit_log_mutation();

CREATE TRIGGER "AuditEvent_no_truncate"
BEFORE TRUNCATE ON public."AuditEvent"
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_audit_log_mutation();
