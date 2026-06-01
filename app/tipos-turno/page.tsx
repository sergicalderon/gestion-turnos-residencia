"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Select } from "@/components/ui";
import type { Department, ShiftType } from "@/lib/database.types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

const emptyForm = { code: "", name: "", computable_hours: 0, color: "#d9efe5", department_id: "" };

export default function ShiftTypesPage() {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadShiftTypes() {
    if (!supabase) return;
    const [{ data, error }, { data: departmentData, error: departmentError }] = await Promise.all([
      supabase.from("shift_types").select("*").order("code"),
      supabase.from("departments").select("*").order("name")
    ]);
    if (error ?? departmentError) setMessage((error ?? departmentError)?.message ?? "");
    setShiftTypes(data ?? []);
    setDepartments(departmentData ?? []);
  }

  useEffect(() => {
    loadShiftTypes();
  }, []);

  async function save() {
    if (!supabase) return;
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      computable_hours: Number(form.computable_hours),
      color: form.color,
      department_id: form.department_id || null
    };
    const result = editingId ? await supabase.from("shift_types").update(payload).eq("id", editingId) : await supabase.from("shift_types").insert(payload);
    if (result.error) setMessage(result.error.message);
    else {
      setForm(emptyForm);
      setEditingId(null);
      await loadShiftTypes();
    }
  }

  async function remove(shiftType: ShiftType) {
    if (!supabase) return;
    const { error } = await supabase.from("shift_types").delete().eq("id", shiftType.id);
    if (error) setMessage("No se puede borrar si ya está usado en planilla o ausencias.");
    await loadShiftTypes();
  }

  return (
    <PageShell title="Tipos de turno" subtitle="Códigos, colores y horas computables.">
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para activar esta pantalla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <form className="rounded-md border border-line bg-white p-4 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? "Editar tipo" : "Nuevo tipo"}</h3>
            {editingId ? <GhostButton type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</GhostButton> : null}
          </div>
          <div className="grid gap-3">
            <Field label="Código"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
            <Field label="Nombre"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Horas computables"><Input type="number" min="0" step="0.25" value={form.computable_hours} onChange={(event) => setForm({ ...form, computable_hours: Number(event.target.value) })} /></Field>
            <Field label="Color"><Input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></Field>
            <Field label="Departamento">
              <Select value={form.department_id} onChange={(event) => setForm({ ...form, department_id: event.target.value })}>
                <option value="">Global</option>
                {departments.filter((department) => department.is_active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </Select>
            </Field>
            <Button type="button" disabled={!form.code || !form.name} onClick={save}>
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </form>

        <div className="grid content-start gap-2">
          {shiftTypes.map((shiftType) => (
            <div key={shiftType.id} className="grid grid-cols-[72px_1fr_120px_auto] items-center gap-3 rounded-md border border-line bg-white px-3 py-2 shadow-subtle">
              <span className="rounded px-2 py-1 text-center text-sm font-bold" style={{ backgroundColor: shiftType.color }}>{shiftType.code}</span>
              <button className="text-left" type="button" onClick={() => { setEditingId(shiftType.id); setForm({ code: shiftType.code, name: shiftType.name, computable_hours: Number(shiftType.computable_hours), color: shiftType.color, department_id: shiftType.department_id ?? "" }); }}>
                <span className="block font-medium">{shiftType.name}</span>
                <span className="text-sm text-moss">{departments.find((department) => department.id === shiftType.department_id)?.name ?? "Global"} · {shiftType.color}</span>
              </button>
              <span className="text-sm">{shiftType.computable_hours} h</span>
              <GhostButton type="button" onClick={() => remove(shiftType)}><Trash2 className="h-4 w-4" /></GhostButton>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
