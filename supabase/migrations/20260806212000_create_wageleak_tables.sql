-- WageLeak is isolated from the existing application by table prefix.
-- No employer names or other free-form personal details are stored.

create table if not exists public.wageleak_calculations (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  hourly_rate numeric(8,2) not null check (hourly_rate between 1 and 500),
  unpaid_minutes_per_day numeric(8,2) not null check (unpaid_minutes_per_day between 0.01 and 720),
  days_per_week numeric(4,2) not null check (days_per_week between 1 and 7),
  weeks_per_year numeric(5,2) not null check (weeks_per_year between 1 and 52),
  years_projected numeric(5,2) not null check (years_projected between 1 and 50),
  annual_hours numeric(12,2) not null check (annual_hours >= 0),
  annual_loss numeric(14,2) not null check (annual_loss >= 0),
  career_loss numeric(16,2) not null check (career_loss >= 0),
  minute_breakdown jsonb not null default '{}'::jsonb,
  industry text null check (industry is null or char_length(industry) <= 60),
  state_code text null check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  source text not null default 'direct' check (char_length(source) between 1 and 80),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists wageleak_calculations_created_at_idx
  on public.wageleak_calculations (created_at desc);
create index if not exists wageleak_calculations_ip_hash_created_at_idx
  on public.wageleak_calculations (ip_hash, created_at desc);

create table if not exists public.wageleak_stats (
  id smallint primary key default 1 check (id = 1),
  total_calculations bigint not null default 0 check (total_calculations >= 0),
  total_annual_loss numeric(20,2) not null default 0 check (total_annual_loss >= 0),
  total_annual_hours numeric(20,2) not null default 0 check (total_annual_hours >= 0),
  updated_at timestamptz not null default now()
);

insert into public.wageleak_stats (id)
values (1)
on conflict (id) do nothing;

create schema if not exists private;

create or replace function private.wageleak_increment_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wageleak_stats
  set total_calculations = total_calculations + 1,
      total_annual_loss = total_annual_loss + new.annual_loss,
      total_annual_hours = total_annual_hours + new.annual_hours,
      updated_at = now()
  where id = 1;
  return new;
end;
$$;

revoke all on function private.wageleak_increment_stats() from public, anon, authenticated;

drop trigger if exists wageleak_calculation_stats_trigger on public.wageleak_calculations;
create trigger wageleak_calculation_stats_trigger
after insert on public.wageleak_calculations
for each row execute function private.wageleak_increment_stats();

create table if not exists public.wageleak_waitlist (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 5 and 254),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  source text not null default 'site' check (char_length(source) between 1 and 80)
);

create unique index if not exists wageleak_waitlist_email_lower_idx
  on public.wageleak_waitlist (lower(email));
create index if not exists wageleak_waitlist_ip_hash_created_at_idx
  on public.wageleak_waitlist (ip_hash, created_at desc);

alter table public.wageleak_calculations enable row level security;
alter table public.wageleak_stats enable row level security;
alter table public.wageleak_waitlist enable row level security;

revoke all on table public.wageleak_calculations from anon, authenticated;
revoke all on table public.wageleak_stats from anon, authenticated;
revoke all on table public.wageleak_waitlist from anon, authenticated;
revoke all on sequence public.wageleak_calculations_id_seq from anon, authenticated;
revoke all on sequence public.wageleak_waitlist_id_seq from anon, authenticated;

grant select, insert on table public.wageleak_calculations to service_role;
grant select, update on table public.wageleak_stats to service_role;
grant select, insert on table public.wageleak_waitlist to service_role;
grant usage, select on sequence public.wageleak_calculations_id_seq to service_role;
grant usage, select on sequence public.wageleak_waitlist_id_seq to service_role;

comment on table public.wageleak_calculations is 'Anonymous aggregate inputs for WageLeak. No employer or person names.';
comment on table public.wageleak_waitlist is 'Founding-list emails collected by the WageLeak Edge Function.';
