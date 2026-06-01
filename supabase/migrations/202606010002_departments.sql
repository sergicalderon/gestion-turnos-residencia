create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists departments_active_name_unique
on public.departments (lower(btrim(name)))
where is_active;

insert into public.departments (name, color)
values
  ('Enfermería', '#bfe3d0'),
  ('Auxiliares', '#d9efe5'),
  ('Limpieza', '#cfe7f5'),
  ('Cocina', '#f4c67a'),
  ('Mantenimiento', '#efd48f'),
  ('Administración', '#cbb7e8'),
  ('Coordinación', '#f19d6b')
on conflict do nothing;

alter table public.employees
  alter column category set default '',
  add column if not exists department_id uuid references public.departments(id) on delete restrict;

insert into public.departments (name)
select distinct btrim(category)
from public.employees
where btrim(coalesce(category, '')) <> ''
  and not exists (
    select 1
    from public.departments
    where lower(btrim(departments.name)) = lower(btrim(employees.category))
  )
on conflict do nothing;

update public.employees employee
set department_id = department.id
from public.departments department
where employee.department_id is null
  and lower(btrim(employee.category)) = lower(btrim(department.name));

alter table public.shift_types
  add column if not exists department_id uuid references public.departments(id) on delete restrict;

alter table public.shift_patterns
  add column if not exists department_id uuid references public.departments(id) on delete restrict;

create table if not exists public.user_departments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'coordinator', 'viewer')),
  created_at timestamptz not null default now(),
  unique (user_id, department_id)
);

create index if not exists employees_department_idx on public.employees (department_id, active);
create index if not exists shift_types_department_idx on public.shift_types (department_id);
create index if not exists shift_patterns_department_idx on public.shift_patterns (department_id);
create index if not exists user_departments_user_idx on public.user_departments (user_id);
create index if not exists user_departments_department_idx on public.user_departments (department_id);

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

alter table public.departments enable row level security;
alter table public.user_departments enable row level security;

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.user_departments to authenticated;

drop policy if exists "Allow app access to departments" on public.departments;
create policy "Allow app access to departments"
on public.departments for all to authenticated
using (true) with check (true);

drop policy if exists "Allow app access to user departments" on public.user_departments;
create policy "Allow app access to user departments"
on public.user_departments for all to authenticated
using (true) with check (true);
