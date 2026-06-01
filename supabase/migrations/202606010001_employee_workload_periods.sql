create extension if not exists "btree_gist";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.employee_workload_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_date date not null,
  end_date date,
  workload_percentage numeric(5,2) not null check (workload_percentage > 0),
  annual_hours_full_time numeric(8,2) not null check (annual_hours_full_time >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_workload_periods_end_after_start check (end_date is null or end_date >= start_date)
);

create index if not exists employee_workload_periods_employee_dates_idx
on public.employee_workload_periods (employee_id, start_date, end_date);

drop trigger if exists employee_workload_periods_set_updated_at on public.employee_workload_periods;
create trigger employee_workload_periods_set_updated_at
before update on public.employee_workload_periods
for each row execute function public.set_updated_at();

create or replace function public.close_previous_open_workload_period()
returns trigger
language plpgsql
as $$
begin
  if new.end_date is null then
    update public.employee_workload_periods
    set end_date = new.start_date - 1
    where employee_id = new.employee_id
      and id <> new.id
      and end_date is null
      and start_date < new.start_date;
  end if;

  return new;
end;
$$;

drop trigger if exists employee_workload_periods_close_previous_open on public.employee_workload_periods;
create trigger employee_workload_periods_close_previous_open
before insert or update on public.employee_workload_periods
for each row execute function public.close_previous_open_workload_period();

create or replace function public.validate_employee_workload_period_overlap()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.employee_workload_periods existing
    where existing.employee_id = new.employee_id
      and existing.id <> new.id
      and daterange(existing.start_date, coalesce(existing.end_date, 'infinity'::date), '[]')
        && daterange(new.start_date, coalesce(new.end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'El empleado ya tiene una jornada solapada en ese rango de fechas.';
  end if;

  return new;
end;
$$;

drop trigger if exists employee_workload_periods_no_overlap on public.employee_workload_periods;
create trigger employee_workload_periods_no_overlap
before insert or update on public.employee_workload_periods
for each row execute function public.validate_employee_workload_period_overlap();

create or replace function public.sync_employee_current_workload()
returns trigger
language plpgsql
as $$
declare
  affected_employee_id uuid;
  current_period record;
begin
  affected_employee_id = coalesce(new.employee_id, old.employee_id);

  select workload_percentage, annual_hours_full_time
  into current_period
  from public.employee_workload_periods
  where employee_id = affected_employee_id
    and start_date <= current_date
    and (end_date is null or end_date >= current_date)
  order by start_date desc
  limit 1;

  if current_period is null then
    select workload_percentage, annual_hours_full_time
    into current_period
    from public.employee_workload_periods
    where employee_id = affected_employee_id
    order by start_date desc
    limit 1;
  end if;

  if current_period is not null then
    update public.employees
    set
      workday_percentage = current_period.workload_percentage,
      annual_target_hours = current_period.annual_hours_full_time
    where id = affected_employee_id;
  end if;

  return null;
end;
$$;

drop trigger if exists employee_workload_periods_sync_employee on public.employee_workload_periods;
create trigger employee_workload_periods_sync_employee
after insert or update or delete on public.employee_workload_periods
for each row execute function public.sync_employee_current_workload();

insert into public.employee_workload_periods (
  employee_id,
  start_date,
  end_date,
  workload_percentage,
  annual_hours_full_time,
  notes
)
select
  id,
  start_date,
  end_date,
  workday_percentage,
  annual_target_hours,
  'Periodo creado automaticamente desde la ficha del empleado'
from public.employees employee
where not exists (
  select 1
  from public.employee_workload_periods period
  where period.employee_id = employee.id
);

alter table public.employee_workload_periods enable row level security;

grant select, insert, update, delete on public.employee_workload_periods to authenticated;

drop policy if exists "Allow app access to employee workload periods" on public.employee_workload_periods;
create policy "Allow app access to employee workload periods"
on public.employee_workload_periods for all to authenticated
using (true) with check (true);
