create table if not exists public.department_shift_coverage_rules (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  shift_type_id uuid not null references public.shift_types(id) on delete cascade,
  day_of_week integer check (day_of_week is null or day_of_week between 1 and 7),
  min_required integer not null default 0 check (min_required >= 0),
  max_allowed integer check (max_allowed is null or max_allowed >= min_required),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists department_shift_coverage_rules_default_unique
on public.department_shift_coverage_rules (department_id, shift_type_id)
where day_of_week is null;

create unique index if not exists department_shift_coverage_rules_day_unique
on public.department_shift_coverage_rules (department_id, shift_type_id, day_of_week)
where day_of_week is not null;

create index if not exists department_shift_coverage_rules_department_idx
on public.department_shift_coverage_rules (department_id, is_active);

create index if not exists department_shift_coverage_rules_shift_type_idx
on public.department_shift_coverage_rules (shift_type_id);

drop trigger if exists department_shift_coverage_rules_set_updated_at on public.department_shift_coverage_rules;
create trigger department_shift_coverage_rules_set_updated_at
before update on public.department_shift_coverage_rules
for each row execute function public.set_updated_at();

alter table public.department_shift_coverage_rules enable row level security;

grant select, insert, update, delete on public.department_shift_coverage_rules to authenticated;

drop policy if exists "Allow app access to department shift coverage rules" on public.department_shift_coverage_rules;
create policy "Allow app access to department shift coverage rules"
on public.department_shift_coverage_rules for all to authenticated
using (true) with check (true);
