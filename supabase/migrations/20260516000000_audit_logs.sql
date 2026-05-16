create table public.audit_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    scan_id text not null,
    verdict text not null,
    layer1_verdict text,
    layer2_verdict text,
    layer3_enabled boolean,
    latency_ms integer,
    layer1_ms integer,
    layer2_ms integer,
    input_length integer,
    kind text,
    pii_masked_count integer,
    threats_blocked jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.audit_logs enable row level security;

create policy "Users can insert their own logs"
    on public.audit_logs for insert
    with check ( auth.uid() = user_id );

create policy "Users can view their own logs"
    on public.audit_logs for select
    using ( auth.uid() = user_id );
