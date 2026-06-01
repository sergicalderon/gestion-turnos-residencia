"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Textarea } from "@/components/ui";
import { currentWorkloadPercentage } from "@/lib/hours";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Employee, EmployeeWorkloadPeriod } from "@/lib/database.types";

const todayIso = new Date().toISOString().slice(0, 10);

const emptyForm = {
  name: "",
  category: "",
  workday_percentage: 100,
  start_date: todayIso,
  end_date: "",
  active: true,
  annual_target_hours: 1772
};

const emptyPeriodForm = {
  start_date: todayIso,
  end_date: "",
  workload_percentage: 100,
  annual_hours_full_time: 1772,
  notes: ""
};

function formatPeriod(period: EmployeeWorkloadPeriod) {
  return `${period.start_date} - ${period.end_date ?? "Actualidad"} -> ${Number(period.workload_percentage)}%`;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workloadPeriods, setWorkloadPeriods] = useState<EmployeeWorkloadPeriod[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [periodForm, setPeriodForm] = useState(emptyPeriodForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    if (!supabase) return;
    const { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .order("active", { ascending: false })
      .order("name");
    const { data: periodData, error: periodError } = await supabase
      .from("employee_workload_periods")
      .select("*")
      .order("start_date");
    const error = employeeError ?? periodError;
    if (error) setMessage(error.message);
    const nextEmployees = employeeData ?? [];
    setEmployees(nextEmployees);
    setWorkloadPeriods(periodData ?? []);
    setSelectedEmployeeId((current) => current ?? nextEmployees[0]?.id ?? null);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );

  const selectedPeriods = useMemo(
    () => workloadPeriods.filter((period) => period.employee_id === selectedEmployeeId),
    [workloadPeriods, selectedEmployeeId]
  );

  const currentWorkload = useMemo(
    () => currentWorkloadPercentage(selectedPeriods),
    [selectedPeriods]
  );

  function resetEmployeeForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function resetPeriodForm() {
    setEditingPeriodId(null);
    setPeriodForm({
      ...emptyPeriodForm,
      start_date: selectedEmployee?.start_date ?? todayIso
    });
  }

  function edit(employee: Employee) {
    setEditingId(employee.id);
    setSelectedEmployeeId(employee.id);
    setForm({
      name: employee.name,
      category: employee.category,
      workday_percentage: Number(employee.workday_percentage),
      start_date: employee.start_date,
      end_date: employee.end_date ?? "",
      active: employee.active,
      annual_target_hours: Number(employee.annual_target_hours)
    });
  }

  function editPeriod(period: EmployeeWorkloadPeriod) {
    setEditingPeriodId(period.id);
    setPeriodForm({
      start_date: period.start_date,
      end_date: period.end_date ?? "",
      workload_percentage: Number(period.workload_percentage),
      annual_hours_full_time: Number(period.annual_hours_full_time),
      notes: period.notes ?? ""
    });
  }

  async function save() {
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      workday_percentage: Number(form.workday_percentage),
      start_date: form.start_date,
      end_date: form.end_date || null,
      active: form.active,
      annual_target_hours: Number(form.annual_target_hours)
    };
    const result = editingId
      ? await supabase.from("employees").update(payload).eq("id", editingId).select().single()
      : await supabase.from("employees").insert(payload).select().single();

    if (result.error) {
      setMessage(result.error.message);
    } else {
      if (!editingId && result.data) {
        const { error: periodError } = await supabase.from("employee_workload_periods").insert({
          employee_id: result.data.id,
          start_date: payload.start_date,
          end_date: payload.end_date,
          workload_percentage: payload.workday_percentage,
          annual_hours_full_time: payload.annual_target_hours,
          notes: "Periodo inicial"
        });
        if (periodError) setMessage(periodError.message);
      }
      resetEmployeeForm();
      setSelectedEmployeeId(result.data?.id ?? selectedEmployeeId);
      await loadData();
    }
    setLoading(false);
  }

  async function savePeriod() {
    if (!supabase || !selectedEmployee) return;
    setLoading(true);
    setMessage("");

    if (!periodForm.start_date) {
      setMessage("No se puede guardar un periodo sin fecha de inicio.");
      setLoading(false);
      return;
    }

    if (Number(periodForm.workload_percentage) <= 0) {
      setMessage("La jornada debe ser mayor que 0.");
      setLoading(false);
      return;
    }

    const payload = {
      employee_id: selectedEmployee.id,
      start_date: periodForm.start_date,
      end_date: periodForm.end_date || null,
      workload_percentage: Number(periodForm.workload_percentage),
      annual_hours_full_time: Number(periodForm.annual_hours_full_time),
      notes: periodForm.notes.trim() || null
    };

    const result = editingPeriodId
      ? await supabase.from("employee_workload_periods").update(payload).eq("id", editingPeriodId)
      : await supabase.from("employee_workload_periods").insert(payload);

    if (result.error) {
      setMessage(result.error.message);
    } else {
      resetPeriodForm();
      await loadData();
    }
    setLoading(false);
  }

  async function closePeriod(period: EmployeeWorkloadPeriod) {
    if (!supabase) return;
    const { error } = await supabase
      .from("employee_workload_periods")
      .update({ end_date: todayIso })
      .eq("id", period.id);
    if (error) setMessage(error.message);
    await loadData();
  }

  async function remove(employee: Employee) {
    if (!supabase) return;
    const { count } = await supabase
      .from("shift_assignments")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employee.id);
    if ((count ?? 0) > 0) {
      setMessage("Este empleado tiene turnos asociados. Se puede marcar como inactivo, pero no borrar.");
      return;
    }
    const { error } = await supabase.from("employees").delete().eq("id", employee.id);
    if (error) setMessage(error.message);
    await loadData();
  }

  async function deactivate(employee: Employee) {
    if (!supabase) return;
    const { error } = await supabase
      .from("employees")
      .update({ active: false, end_date: employee.end_date ?? todayIso })
      .eq("id", employee.id);
    if (error) setMessage(error.message);
    await loadData();
  }

  return (
    <PageShell title="Empleados" subtitle="Alta, edición e inactivación de personal.">
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para activar esta pantalla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form className="rounded-md border border-line bg-white p-4 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? "Editar empleado" : "Nuevo empleado"}</h3>
            {editingId ? <GhostButton type="button" onClick={resetEmployeeForm}>Cancelar</GhostButton> : null}
          </div>
          <div className="grid gap-3">
            <Field label="Nombre"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Categoría"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
            <Field label="Jornada inicial / actual"><Input type="number" min="1" value={form.workday_percentage} onChange={(event) => setForm({ ...form, workday_percentage: Number(event.target.value) })} /></Field>
            <Field label="Fecha alta"><Input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></Field>
            <Field label="Fecha baja"><Input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></Field>
            <Field label="Horas anuales jornada completa"><Input type="number" min="0" value={form.annual_target_hours} onChange={(event) => setForm({ ...form, annual_target_hours: Number(event.target.value) })} /></Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              Activo
            </label>
            <Button type="button" disabled={loading || !form.name || !form.category || !form.start_date} onClick={save}>
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </form>

        <div className="grid gap-5">
          <div className="overflow-auto rounded-md border border-line bg-white shadow-subtle">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
                <tr>
                  <th className="border-b border-line px-3 py-3">Nombre</th>
                  <th className="border-b border-line px-3 py-3">Categoría</th>
                  <th className="border-b border-line px-3 py-3">Jornada actual</th>
                  <th className="border-b border-line px-3 py-3">Alta</th>
                  <th className="border-b border-line px-3 py-3">Baja</th>
                  <th className="border-b border-line px-3 py-3">Estado</th>
                  <th className="border-b border-line px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const employeePeriods = workloadPeriods.filter((period) => period.employee_id === employee.id);
                  const rowCurrentWorkload = currentWorkloadPercentage(employeePeriods);
                  return (
                    <tr key={employee.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-3 font-medium">{employee.name}</td>
                      <td className="px-3 py-3">{employee.category}</td>
                      <td className="px-3 py-3">{rowCurrentWorkload ? `${rowCurrentWorkload}%` : "Sin jornada"}</td>
                      <td className="px-3 py-3">{employee.start_date}</td>
                      <td className="px-3 py-3">{employee.end_date ?? "-"}</td>
                      <td className="px-3 py-3">{employee.active ? "Activo" : "Inactivo"}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <GhostButton type="button" onClick={() => setSelectedEmployeeId(employee.id)}><Check className="h-4 w-4" /></GhostButton>
                          <GhostButton type="button" onClick={() => edit(employee)}>Editar</GhostButton>
                          {employee.active ? <GhostButton type="button" onClick={() => deactivate(employee)}><Archive className="h-4 w-4" /></GhostButton> : null}
                          <GhostButton type="button" onClick={() => remove(employee)}><Trash2 className="h-4 w-4" /></GhostButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="rounded-md border border-line bg-white p-4 shadow-subtle">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Historial de jornada</h3>
                <p className="mt-1 text-sm text-moss">
                  {selectedEmployee ? `${selectedEmployee.name} · Jornada actual: ${currentWorkload ? `${currentWorkload}%` : "sin definir"}` : "Selecciona un empleado"}
                </p>
              </div>
            </div>

            {selectedEmployee ? (
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="overflow-auto rounded-md border border-line">
                  <table className="min-w-[720px] w-full border-collapse text-sm">
                    <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
                      <tr>
                        <th className="border-b border-line px-3 py-3">Periodo</th>
                        <th className="border-b border-line px-3 py-3 text-right">Jornada</th>
                        <th className="border-b border-line px-3 py-3 text-right">Horas convenio</th>
                        <th className="border-b border-line px-3 py-3">Notas</th>
                        <th className="border-b border-line px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPeriods.length === 0 ? (
                        <tr><td className="px-3 py-6 text-center text-sm text-coral" colSpan={5}>Sin jornada definida para este periodo</td></tr>
                      ) : selectedPeriods.map((period) => (
                        <tr key={period.id} className="border-b border-line last:border-0">
                          <td className="px-3 py-3 font-medium">{formatPeriod(period)}</td>
                          <td className="px-3 py-3 text-right">{period.workload_percentage}%</td>
                          <td className="px-3 py-3 text-right">{period.annual_hours_full_time} h</td>
                          <td className="px-3 py-3">{period.notes ?? "-"}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <GhostButton type="button" onClick={() => editPeriod(period)}><Pencil className="h-4 w-4" /></GhostButton>
                              {!period.end_date ? <GhostButton type="button" onClick={() => closePeriod(period)}><X className="h-4 w-4" /></GhostButton> : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <form className="rounded-md border border-line bg-paper p-4" onSubmit={(event) => event.preventDefault()}>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-semibold">{editingPeriodId ? "Editar periodo" : "Nuevo periodo"}</h4>
                    {editingPeriodId ? <GhostButton type="button" onClick={resetPeriodForm}>Cancelar</GhostButton> : null}
                  </div>
                  <div className="grid gap-3">
                    <Field label="Inicio"><Input type="date" value={periodForm.start_date} onChange={(event) => setPeriodForm({ ...periodForm, start_date: event.target.value })} /></Field>
                    <Field label="Fin"><Input type="date" value={periodForm.end_date} onChange={(event) => setPeriodForm({ ...periodForm, end_date: event.target.value })} /></Field>
                    <Field label="Jornada"><Input type="number" min="1" value={periodForm.workload_percentage} onChange={(event) => setPeriodForm({ ...periodForm, workload_percentage: Number(event.target.value) })} /></Field>
                    <Field label="Horas convenio"><Input type="number" min="0" value={periodForm.annual_hours_full_time} onChange={(event) => setPeriodForm({ ...periodForm, annual_hours_full_time: Number(event.target.value) })} /></Field>
                    <Field label="Notas"><Textarea value={periodForm.notes} onChange={(event) => setPeriodForm({ ...periodForm, notes: event.target.value })} /></Field>
                    <Button type="button" disabled={loading || !periodForm.start_date} onClick={savePeriod}>
                      {editingPeriodId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      Guardar periodo
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
