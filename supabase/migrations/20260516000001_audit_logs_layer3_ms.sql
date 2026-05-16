alter table public.audit_logs
    add column if not exists layer3_ms integer;
