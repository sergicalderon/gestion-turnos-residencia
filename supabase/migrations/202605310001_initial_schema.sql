create extension if not exists "pgcrypto";

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  workday_percentage numeric(5,2) not null default 100 check (workday_percentage > 0 and workday_percentage <= 100),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  annual_target_hours numeric(8,2) not null default 0 check (annual_target_hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_end_after_start check (end_date is null or end_date >= start_date)
);

create table if not exists public.shift_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  computable_hours numeric(5,2) not null default 0 check (computable_hours >= 0),
  color text not null default '#d9efe5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  date date not null,
  shift_type_id uuid not null references public.shift_types(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, date)
);

create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  shift_type_id uuid not null references public.shift_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absences_end_after_start check (end_date >= start_date)
);

create index if not exists employees_active_dates_idx on public.employees (active, start_date, end_date);
create index if not exists shift_assignments_employee_date_idx on public.shift_assignments (employee_id, date);
create index if not exists shift_assignments_date_idx on public.shift_assignments (date);
create index if not exists absences_employee_dates_idx on public.absences (employee_id, start_date, end_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists shift_types_set_updated_at on public.shift_types;
create trigger shift_types_set_updated_at
before update on public.shift_types
for each row execute function public.set_updated_at();

drop trigger if exists shift_assignments_set_updated_at on public.shift_assignments;
create trigger shift_assignments_set_updated_at
before update on public.shift_assignments
for each row execute function public.set_updated_at();

drop trigger if exists absences_set_updated_at on public.absences;
create trigger absences_set_updated_at
before update on public.absences
for each row execute function public.set_updated_at();

alter table public.employees enable row level security;
alter table public.shift_types enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.absences enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.shift_types to authenticated;
grant select, insert, update, delete on public.shift_assignments to authenticated;
grant select, insert, update, delete on public.absences to authenticated;

drop policy if exists "Allow app access to employees" on public.employees;
create policy "Allow app access to employees"
on public.employees for all to authenticated
using (true) with check (true);

drop policy if exists "Allow app access to shift types" on public.shift_types;
create policy "Allow app access to shift types"
on public.shift_types for all to authenticated
using (true) with check (true);

drop policy if exists "Allow app access to shift assignments" on public.shift_assignments;
create policy "Allow app access to shift assignments"
on public.shift_assignments for all to authenticated
using (true) with check (true);

drop policy if exists "Allow app access to absences" on public.absences;
create policy "Allow app access to absences"
on public.absences for all to authenticated
using (true) with check (true);

insert into public.shift_types (code, name, computable_hours, color)
values
  ('M', 'Mañana', 7.00, '#bfe3d0'),
  ('T', 'Tarde', 7.00, '#f4c67a'),
  ('MT', 'Turno 12h día', 12.00, '#f19d6b'),
  ('N', 'Noche', 10.00, '#9bb6df'),
  ('L', 'Libre', 0.00, '#e7ece9'),
  ('V', 'Vacaciones', 0.00, '#cbb7e8'),
  ('G', 'Guardia/gestión', 8.00, '#efd48f')
on conflict (code) do update set
  name = excluded.name,
  computable_hours = excluded.computable_hours,
  color = excluded.color;
