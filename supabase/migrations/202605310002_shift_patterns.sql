create extension if not exists "btree_gist";

create table if not exists public.shift_patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_pattern_days (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.shift_patterns(id) on delete cascade,
  day_index integer not null check (day_index >= 0),
  shift_type_id uuid not null references public.shift_types(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pattern_id, day_index)
);

create table if not exists public.employee_shift_patterns (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  pattern_id uuid not null references public.shift_patterns(id) on delete restrict,
  start_date date not null,
  end_date date,
  start_day_index integer not null default 0 check (start_day_index >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_shift_patterns_end_after_start check (end_date is null or end_date >= start_date)
);

alter table public.shift_assignments
  add column if not exists source text not null default 'manual' check (source in ('manual', 'pattern')),
  add column if not exists employee_shift_pattern_id uuid references public.employee_shift_patterns(id) on delete set null,
  add column if not exists generated_at timestamptz;

create index if not exists shift_pattern_days_pattern_idx on public.shift_pattern_days (pattern_id, day_index);
create index if not exists employee_shift_patterns_employee_dates_idx on public.employee_shift_patterns (employee_id, start_date, end_date, is_active);
create index if not exists shift_assignments_source_idx on public.shift_assignments (source);

drop trigger if exists shift_patterns_set_updated_at on public.shift_patterns;
create trigger shift_patterns_set_updated_at
before update on public.shift_patterns
for each row execute function public.set_updated_at();

drop trigger if exists shift_pattern_days_set_updated_at on public.shift_pattern_days;
create trigger shift_pattern_days_set_updated_at
before update on public.shift_pattern_days
for each row execute function public.set_updated_at();

drop trigger if exists employee_shift_patterns_set_updated_at on public.employee_shift_patterns;
create trigger employee_shift_patterns_set_updated_at
before update on public.employee_shift_patterns
for each row execute function public.set_updated_at();

create or replace function public.validate_employee_shift_pattern_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.is_active and exists (
    select 1
    from public.employee_shift_patterns existing
    where existing.employee_id = new.employee_id
      and existing.is_active
      and existing.id <> new.id
      and daterange(existing.start_date, coalesce(existing.end_date, 'infinity'::date), '[]')
        && daterange(new.start_date, coalesce(new.end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'El empleado ya tiene un patron activo solapado en ese rango de fechas.';
  end if;
  return new;
end;
$$;

drop trigger if exists employee_shift_patterns_no_overlap on public.employee_shift_patterns;
create trigger employee_shift_patterns_no_overlap
before insert or update on public.employee_shift_patterns
for each row execute function public.validate_employee_shift_pattern_overlap();

alter table public.shift_patterns enable row level security;
alter table public.shift_pattern_days enable row level security;
alter table public.employee_shift_patterns enable row level security;

grant select, insert, update, delete on public.shift_patterns to authenticated;
grant select, insert, update, delete on public.shift_pattern_days to authenticated;
grant select, insert, update, delete on public.employee_shift_patterns to authenticated;

drop policy if exists "Allow app access to shift patterns" on public.shift_patterns;
create policy "Allow app access to shift patterns"
on public.shift_patterns for all to authenticated
using (true) with check (true);

drop policy if exists "Allow app access to shift pattern days" on public.shift_pattern_days;
create policy "Allow app access to shift pattern days"
on public.shift_pattern_days for all to authenticated
using (true) with check (true);

drop policy if exists "Allow app access to employee shift patterns" on public.employee_shift_patterns;
create policy "Allow app access to employee shift patterns"
on public.employee_shift_patterns for all to authenticated
using (true) with check (true);
