"use client";

import { useEffect, useState } from "react";
import { Archive, Plus, Save, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice } from "@/components/ui";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Employee } from "@/lib/database.types";

const emptyForm = {
  name: "",
  category: "",
  workday_percentage: 100,
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  active: true,
  annual_target_hours: 1780
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadEmployees() {
    if (!supabase) return;
    const { data, error } = await supabase.from("employees").select("*").order("active", { ascending: false }).order("name");
    if (error) setMessage(error.message);
    setEmployees(data ?? []);
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  function edit(employee: Employee) {
    setEditingId(employee.id);
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
      ? await supabase.from("employees").update(payload).eq("id", editingId)
      : await supabase.from("employees").insert(payload);
    if (result.error) {
      setMessage(result.error.message);
    } else {
      setForm(emptyForm);
      setEditingId(null);
      await loadEmployees();
    }
    setLoading(false);
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
    await loadEmployees();
  }

  async function deactivate(employee: Employee) {
    if (!supabase) return;
    const { error } = await supabase.from("employees").update({ active: false, end_date: employee.end_date ?? new Date().toISOString().slice(0, 10) }).eq("id", employee.id);
    if (error) setMessage(error.message);
    await loadEmployees();
  }

  return (
    <PageShell title="Empleados" subtitle="Alta, edición e inactivación de personal.">
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para activar esta pantalla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form className="rounded-md border border-line bg-white p-4 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? "Editar empleado" : "Nuevo empleado"}</h3>
            {editingId ? <GhostButton type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</GhostButton> : null}
          </div>
          <div className="grid gap-3">
            <Field label="Nombre"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Categoría"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
            <Field label="Porcentaje jornada"><Input type="number" min="1" max="100" value={form.workday_percentage} onChange={(event) => setForm({ ...form, workday_percentage: Number(event.target.value) })} /></Field>
            <Field label="Fecha alta"><Input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></Field>
            <Field label="Fecha baja"><Input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></Field>
            <Field label="Horas anuales objetivo"><Input type="number" min="0" value={form.annual_target_hours} onChange={(event) => setForm({ ...form, annual_target_hours: Number(event.target.value) })} /></Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              Activo
            </label>
            <Button type="button" disabled={loading || !form.name || !form.category} onClick={save}>
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </form>

        <div className="overflow-auto rounded-md border border-line bg-white shadow-subtle">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
              <tr>
                <th className="border-b border-line px-3 py-3">Nombre</th>
                <th className="border-b border-line px-3 py-3">Categoría</th>
                <th className="border-b border-line px-3 py-3">Jornada</th>
                <th className="border-b border-line px-3 py-3">Alta</th>
                <th className="border-b border-line px-3 py-3">Baja</th>
                <th className="border-b border-line px-3 py-3">Objetivo</th>
                <th className="border-b border-line px-3 py-3">Estado</th>
                <th className="border-b border-line px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-medium">{employee.name}</td>
                  <td className="px-3 py-3">{employee.category}</td>
                  <td className="px-3 py-3">{employee.workday_percentage}%</td>
                  <td className="px-3 py-3">{employee.start_date}</td>
                  <td className="px-3 py-3">{employee.end_date ?? "-"}</td>
                  <td className="px-3 py-3">{employee.annual_target_hours} h</td>
                  <td className="px-3 py-3">{employee.active ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <GhostButton type="button" onClick={() => edit(employee)}>Editar</GhostButton>
                      {employee.active ? <GhostButton type="button" onClick={() => deactivate(employee)}><Archive className="h-4 w-4" /></GhostButton> : null}
                      <GhostButton type="button" onClick={() => remove(employee)}><Trash2 className="h-4 w-4" /></GhostButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
