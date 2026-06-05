create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.shift_assignments
  drop constraint if exists shift_assignments_source_check;

alter table public.shift_assignments
  add constraint shift_assignments_source_check
  check (source in ('manual', 'pattern', 'absence', 'swap'));

alter table public.shift_assignments
  add column if not exists source_id uuid,
  add column if not exists updated_by_user_id uuid references auth.users(id) on delete set null;

create table if not exists public.shift_swaps (
  id uuid primary key default gen_random_uuid(),
  employee_a_id uuid not null references public.employees(id) on delete restrict,
  employee_b_id uuid not null references public.employees(id) on delete restrict,
  employee_a_original_date date not null,
  employee_b_original_date date not null,
  employee_a_original_shift_id uuid not null references public.shift_types(id) on delete restrict,
  employee_b_original_shift_id uuid not null references public.shift_types(id) on delete restrict,
  employee_a_new_shift_id uuid not null references public.shift_types(id) on delete restrict,
  employee_b_new_shift_id uuid not null references public.shift_types(id) on delete restrict,
  employee_a_previous_source text not null check (employee_a_previous_source in ('manual', 'pattern', 'absence', 'swap')),
  employee_a_previous_source_id uuid,
  employee_b_previous_source text not null check (employee_b_previous_source in ('manual', 'pattern', 'absence', 'swap')),
  employee_b_previous_source_id uuid,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason text,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_swaps_distinct_cells check (
    employee_a_id <> employee_b_id
    or employee_a_original_date <> employee_b_original_date
  )
);

create index if not exists shift_assignments_source_source_id_idx on public.shift_assignments (source, source_id);
create index if not exists shift_assignments_updated_by_user_idx on public.shift_assignments (updated_by_user_id);
create index if not exists shift_swaps_employee_a_date_idx on public.shift_swaps (employee_a_id, employee_a_original_date);
create index if not exists shift_swaps_employee_b_date_idx on public.shift_swaps (employee_b_id, employee_b_original_date);
create index if not exists shift_swaps_status_idx on public.shift_swaps (status);
create index if not exists shift_swaps_created_at_idx on public.shift_swaps (created_at desc);

drop trigger if exists shift_swaps_set_updated_at on public.shift_swaps;
create trigger shift_swaps_set_updated_at
before update on public.shift_swaps
for each row execute function public.set_updated_at();

alter table public.shift_swaps enable row level security;

grant select, insert, update, delete on public.shift_swaps to authenticated;

drop policy if exists "Allow app access to shift swaps" on public.shift_swaps;
create policy "Allow app access to shift swaps"
on public.shift_swaps for all to authenticated
using (true) with check (true);

create or replace function public.register_approved_shift_swap(
  p_employee_a_id uuid,
  p_employee_a_date date,
  p_employee_b_id uuid,
  p_employee_b_date date,
  p_reason text default null
)
returns public.shift_swaps
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_a public.shift_assignments%rowtype;
  assignment_b public.shift_assignments%rowtype;
  created_swap public.shift_swaps%rowtype;
  current_user_id uuid := auth.uid();
begin
  if p_employee_a_id is null or p_employee_b_id is null or p_employee_a_date is null or p_employee_b_date is null then
    raise exception 'Selecciona dos empleados y dos fechas para registrar el cambio de turno.';
  end if;

  if p_employee_a_id = p_employee_b_id and p_employee_a_date = p_employee_b_date then
    raise exception 'No se puede registrar un cambio de turno contra la misma celda.';
  end if;

  select *
  into assignment_a
  from public.shift_assignments
  where employee_id = p_employee_a_id
    and date = p_employee_a_date
  for update;

  if not found then
    raise exception 'La primera celda seleccionada no tiene un turno asignado.';
  end if;

  select *
  into assignment_b
  from public.shift_assignments
  where employee_id = p_employee_b_id
    and date = p_employee_b_date
  for update;

  if not found then
    raise exception 'La segunda celda seleccionada no tiene un turno asignado.';
  end if;

  insert into public.shift_swaps (
    employee_a_id,
    employee_b_id,
    employee_a_original_date,
    employee_b_original_date,
    employee_a_original_shift_id,
    employee_b_original_shift_id,
    employee_a_new_shift_id,
    employee_b_new_shift_id,
    employee_a_previous_source,
    employee_a_previous_source_id,
    employee_b_previous_source,
    employee_b_previous_source_id,
    status,
    reason,
    requested_by_user_id,
    approved_by_user_id,
    approved_at
  )
  values (
    assignment_a.employee_id,
    assignment_b.employee_id,
    assignment_a.date,
    assignment_b.date,
    assignment_a.shift_type_id,
    assignment_b.shift_type_id,
    assignment_b.shift_type_id,
    assignment_a.shift_type_id,
    assignment_a.source,
    assignment_a.source_id,
    assignment_b.source,
    assignment_b.source_id,
    'approved',
    nullif(btrim(p_reason), ''),
    current_user_id,
    current_user_id,
    now()
  )
  returning * into created_swap;

  update public.shift_assignments
  set
    shift_type_id = assignment_b.shift_type_id,
    source = 'swap',
    source_id = created_swap.id,
    employee_shift_pattern_id = null,
    generated_at = null,
    updated_by_user_id = current_user_id
  where id = assignment_a.id;

  update public.shift_assignments
  set
    shift_type_id = assignment_a.shift_type_id,
    source = 'swap',
    source_id = created_swap.id,
    employee_shift_pattern_id = null,
    generated_at = null,
    updated_by_user_id = current_user_id
  where id = assignment_b.id;

  return created_swap;
end;
$$;

grant execute on function public.register_approved_shift_swap(uuid, date, uuid, date, text) to authenticated;
