"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Textarea } from "@/components/ui";
import type { Department, Employee } from "@/lib/database.types";
import { normalizeDepartmentName } from "@/lib/departments";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

const emptyForm = {
  name: "",
  description: "",
  color: "#d9efe5",
  is_active: true
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Pick<Employee, "id" | "department_id" | "active">[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const activeEmployeeCount = useMemo(() => {
    return employees.reduce((counts, employee) => {
      if (employee.active && employee.department_id) {
        counts.set(employee.department_id, (counts.get(employee.department_id) ?? 0) + 1);
      }
      return counts;
    }, new Map<string, number>());
  }, [employees]);

  async function loadData() {
    if (!supabase) return;
    const [{ data: departmentData, error: departmentError }, { data: employeeData, error: employeeError }] = await Promise.all([
      supabase.from("departments").select("*").order("is_active", { ascending: false }).order("name"),
      supabase.from("employees").select("id, department_id, active")
    ]);
    const error = departmentError ?? employeeError;
    if (error) setMessage(error.message);
    setDepartments(departmentData ?? []);
    setEmployees((employeeData as Pick<Employee, "id" | "department_id" | "active">[]) ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function edit(department: Department) {
    setEditingId(department.id);
    setForm({
      name: department.name,
      description: department.description ?? "",
      color: department.color ?? "#d9efe5",
      is_active: department.is_active
    });
  }

  async function save() {
    if (!supabase) return;
    setMessage("");
    const name = form.name.trim();
    if (!name) {
      setMessage("El departamento necesita nombre.");
      return;
    }
    const duplicate = departments.some((department) =>
      department.id !== editingId &&
      department.is_active &&
      form.is_active &&
      normalizeDepartmentName(department.name) === normalizeDepartmentName(name)
    );
    if (duplicate) {
      setMessage("Ya existe un departamento activo con ese nombre.");
      return;
    }

    setLoading(true);
    const payload = {
      name,
      description: form.description.trim() || null,
      color: form.color || null,
      is_active: form.is_active
    };
    const result = editingId
      ? await supabase.from("departments").update(payload).eq("id", editingId)
      : await supabase.from("departments").insert(payload);
    if (result.error) setMessage(result.error.message);
    else {
      resetForm();
      await loadData();
    }
    setLoading(false);
  }

  async function toggleActive(department: Department) {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.from("departments").update({ is_active: !department.is_active }).eq("id", department.id);
    if (error) setMessage(error.message);
    await loadData();
  }

  return (
    <PageShell title="Departamentos" subtitle="Áreas fijas para empleados, turnos y patrones.">
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para activar esta pantalla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form className="rounded-md border border-line bg-white p-4 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? "Editar departamento" : "Nuevo departamento"}</h3>
            {editingId ? <GhostButton type="button" onClick={resetForm}>Cancelar</GhostButton> : null}
          </div>
          <div className="grid gap-3">
            <Field label="Nombre"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Descripción"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <Field label="Color"><Input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
              Activo
            </label>
            <Button type="button" disabled={loading || !form.name} onClick={save}>
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </form>

        <div className="overflow-auto rounded-md border border-line bg-white shadow-subtle">
          <table className="min-w-[820px] w-full border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
              <tr>
                <th className="border-b border-line px-3 py-3">Departamento</th>
                <th className="border-b border-line px-3 py-3">Descripción</th>
                <th className="border-b border-line px-3 py-3 text-right">Empleados activos</th>
                <th className="border-b border-line px-3 py-3">Estado</th>
                <th className="border-b border-line px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded px-2 py-1 font-semibold" style={{ backgroundColor: department.color ?? "#eef2ef" }}>
                      {department.name}
                    </span>
                  </td>
                  <td className="px-3 py-3">{department.description ?? "-"}</td>
                  <td className="px-3 py-3 text-right">{activeEmployeeCount.get(department.id) ?? 0}</td>
                  <td className="px-3 py-3">{department.is_active ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <GhostButton type="button" onClick={() => edit(department)}>Editar</GhostButton>
                      <GhostButton type="button" onClick={() => toggleActive(department)}>
                        {department.is_active ? "Desactivar" : "Activar"}
                      </GhostButton>
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
