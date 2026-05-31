"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Select, Textarea } from "@/components/ui";
import type { Employee, EmployeeShiftPattern, ShiftPattern, ShiftPatternDay, ShiftType } from "@/lib/database.types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

const todayIso = new Date().toISOString().slice(0, 10);

type PatternForm = {
  name: string;
  description: string;
  is_active: boolean;
  days: string[];
};

const emptyPattern: PatternForm = {
  name: "",
  description: "",
  is_active: true,
  days: []
};

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [patternDays, setPatternDays] = useState<ShiftPatternDay[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EmployeeShiftPattern[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [patternForm, setPatternForm] = useState<PatternForm>(emptyPattern);
  const [assignmentForm, setAssignmentForm] = useState({
    employee_id: "",
    pattern_id: "",
    start_date: todayIso,
    end_date: "",
    start_day_index: 0,
    is_active: true
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const shiftTypeById = useMemo(() => new Map(shiftTypes.map((type) => [type.id, type])), [shiftTypes]);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const patternById = useMemo(() => new Map(patterns.map((pattern) => [pattern.id, pattern])), [patterns]);

  async function loadData() {
    if (!supabase) return;
    setMessage("");
    const [
      { data: patternData, error: patternError },
      { data: dayData, error: dayError },
      { data: shiftTypeData, error: shiftTypeError },
      { data: employeeData, error: employeeError },
      { data: assignmentData, error: assignmentError }
    ] = await Promise.all([
      supabase.from("shift_patterns").select("*").order("name"),
      supabase.from("shift_pattern_days").select("*").order("day_index"),
      supabase.from("shift_types").select("*").order("code"),
      supabase.from("employees").select("*").order("name"),
      supabase.from("employee_shift_patterns").select("*").order("start_date", { ascending: false })
    ]);
    const error = patternError ?? dayError ?? shiftTypeError ?? employeeError ?? assignmentError;
    if (error) setMessage(error.message);
    setPatterns(patternData ?? []);
    setPatternDays(dayData ?? []);
    setShiftTypes(shiftTypeData ?? []);
    setEmployees(employeeData ?? []);
    setAssignments(assignmentData ?? []);

    setAssignmentForm((current) => ({
      ...current,
      employee_id: current.employee_id || employeeData?.[0]?.id || "",
      pattern_id: current.pattern_id || patternData?.[0]?.id || ""
    }));
  }

  useEffect(() => {
    loadData();
  }, []);

  function selectPattern(pattern: ShiftPattern) {
    const days = patternDays
      .filter((day) => day.pattern_id === pattern.id)
      .sort((a, b) => a.day_index - b.day_index)
      .map((day) => day.shift_type_id);
    setSelectedPatternId(pattern.id);
    setPatternForm({
      name: pattern.name,
      description: pattern.description,
      is_active: pattern.is_active,
      days
    });
  }

  function resetPattern() {
    setSelectedPatternId(null);
    setPatternForm({ ...emptyPattern, days: shiftTypes[0]?.id ? [shiftTypes[0].id] : [] });
  }

  function updateDay(index: number, shiftTypeId: string) {
    setPatternForm((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) => (dayIndex === index ? shiftTypeId : day))
    }));
  }

  async function savePattern() {
    if (!supabase) return;
    setMessage("");
    if (!patternForm.name.trim()) {
      setMessage("El patron necesita nombre.");
      return;
    }
    if (patternForm.days.length === 0 || patternForm.days.some((day) => !day)) {
      setMessage("El patron necesita al menos un dia con tipo de turno.");
      return;
    }

    setSaving(true);
    const payload = {
      name: patternForm.name.trim(),
      description: patternForm.description.trim(),
      is_active: patternForm.is_active
    };
    const patternResult = selectedPatternId
      ? await supabase.from("shift_patterns").update(payload).eq("id", selectedPatternId).select("*").single()
      : await supabase.from("shift_patterns").insert(payload).select("*").single();

    if (patternResult.error) {
      setMessage(patternResult.error.message);
      setSaving(false);
      return;
    }

    const patternId = patternResult.data.id;
    const deleteResult = await supabase.from("shift_pattern_days").delete().eq("pattern_id", patternId);
    if (deleteResult.error) {
      setMessage(deleteResult.error.message);
      setSaving(false);
      return;
    }

    const insertResult = await supabase.from("shift_pattern_days").insert(
      patternForm.days.map((shiftTypeId, index) => ({
        pattern_id: patternId,
        day_index: index,
        shift_type_id: shiftTypeId
      }))
    );
    if (insertResult.error) setMessage(insertResult.error.message);
    await loadData();
    setSelectedPatternId(patternId);
    setSaving(false);
  }

  async function removePattern(pattern: ShiftPattern) {
    if (!supabase) return;
    const { error } = await supabase.from("shift_patterns").delete().eq("id", pattern.id);
    if (error) setMessage("No se puede borrar si ya esta asignado a empleados.");
    await loadData();
    if (selectedPatternId === pattern.id) resetPattern();
  }

  async function saveAssignment() {
    if (!supabase) return;
    setMessage("");
    const selectedDays = patternDays.filter((day) => day.pattern_id === assignmentForm.pattern_id);
    if (selectedDays.length === 0) {
      setMessage("No se puede asignar un patron sin dias.");
      return;
    }
    if (Number(assignmentForm.start_day_index) >= selectedDays.length) {
      setMessage("El dia inicial del ciclo no puede superar la longitud del patron.");
      return;
    }
    const { error } = await supabase.from("employee_shift_patterns").insert({
      employee_id: assignmentForm.employee_id,
      pattern_id: assignmentForm.pattern_id,
      start_date: assignmentForm.start_date,
      end_date: assignmentForm.end_date || null,
      start_day_index: Number(assignmentForm.start_day_index),
      is_active: assignmentForm.is_active
    });
    if (error) setMessage(error.message);
    await loadData();
  }

  async function deactivateAssignment(assignment: EmployeeShiftPattern) {
    if (!supabase) return;
    const { error } = await supabase.from("employee_shift_patterns").update({ is_active: false }).eq("id", assignment.id);
    if (error) setMessage(error.message);
    await loadData();
  }

  const preview = patternForm.days.map((shiftTypeId) => shiftTypeById.get(shiftTypeId)?.code ?? "?").join(" - ");

  return (
    <PageShell title="Patrones de turno" subtitle="Ciclos repetitivos y asignacion a empleados.">
      {!isSupabaseConfigured ? <Notice>Configura Supabase para usar patrones.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Listado</h3>
            <GhostButton type="button" onClick={resetPattern}><Plus className="h-4 w-4" />Nuevo</GhostButton>
          </div>
          {patterns.map((pattern) => {
            const days = patternDays.filter((day) => day.pattern_id === pattern.id);
            return (
              <button
                key={pattern.id}
                type="button"
                className="rounded-md border border-line bg-white p-3 text-left shadow-subtle hover:bg-paper"
                onClick={() => selectPattern(pattern)}
              >
                <span className="block font-semibold">{pattern.name}</span>
                <span className="text-sm text-moss">{days.length} dias · {pattern.is_active ? "Activo" : "Inactivo"}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-5">
          <form className="rounded-md border border-line bg-white p-4 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">{selectedPatternId ? "Editar patron" : "Nuevo patron"}</h3>
              {selectedPatternId ? <GhostButton type="button" onClick={() => selectedPatternId && removePattern(patternById.get(selectedPatternId)!)}><Trash2 className="h-4 w-4" /></GhostButton> : null}
            </div>
            <div className="grid gap-3">
              <Field label="Nombre"><Input value={patternForm.name} onChange={(event) => setPatternForm({ ...patternForm, name: event.target.value })} /></Field>
              <Field label="Descripcion"><Textarea value={patternForm.description} onChange={(event) => setPatternForm({ ...patternForm, description: event.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={patternForm.is_active} onChange={(event) => setPatternForm({ ...patternForm, is_active: event.target.checked })} />
                Activo
              </label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Dias del ciclo</span>
                  <GhostButton type="button" onClick={() => setPatternForm({ ...patternForm, days: [...patternForm.days, shiftTypes[0]?.id ?? ""] })}>Añadir dia</GhostButton>
                </div>
                {patternForm.days.map((shiftTypeId, index) => (
                  <div key={`${index}-${shiftTypeId}`} className="grid grid-cols-[72px_1fr_auto] items-center gap-2">
                    <span className="text-sm text-moss">Dia {index + 1}</span>
                    <Select value={shiftTypeId} onChange={(event) => updateDay(index, event.target.value)}>
                      {shiftTypes.map((type) => <option key={type.id} value={type.id}>{type.code} · {type.name}</option>)}
                    </Select>
                    <GhostButton type="button" onClick={() => setPatternForm({ ...patternForm, days: patternForm.days.filter((_day, dayIndex) => dayIndex !== index) })}>
                      <Trash2 className="h-4 w-4" />
                    </GhostButton>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-line bg-paper px-3 py-2 text-sm">
                <span className="font-semibold">Vista previa: </span>{preview || "-"}
              </div>
              <Button type="button" disabled={saving} onClick={savePattern}><Save className="h-4 w-4" />Guardar patron</Button>
            </div>
          </form>

          <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <form className="rounded-md border border-line bg-white p-4 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
              <h3 className="mb-4 font-semibold">Asignar a empleado</h3>
              <div className="grid gap-3">
                <Field label="Empleado">
                  <Select value={assignmentForm.employee_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, employee_id: event.target.value })}>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                  </Select>
                </Field>
                <Field label="Patron">
                  <Select value={assignmentForm.pattern_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, pattern_id: event.target.value })}>
                    {patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
                  </Select>
                </Field>
                <Field label="Fecha inicio"><Input type="date" value={assignmentForm.start_date} onChange={(event) => setAssignmentForm({ ...assignmentForm, start_date: event.target.value })} /></Field>
                <Field label="Fecha fin"><Input type="date" value={assignmentForm.end_date} onChange={(event) => setAssignmentForm({ ...assignmentForm, end_date: event.target.value })} /></Field>
                <Field label="Dia inicial del ciclo">
                  <Input type="number" min="0" value={assignmentForm.start_day_index} onChange={(event) => setAssignmentForm({ ...assignmentForm, start_day_index: Number(event.target.value) })} />
                </Field>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={assignmentForm.is_active} onChange={(event) => setAssignmentForm({ ...assignmentForm, is_active: event.target.checked })} />
                  Activa
                </label>
                <Button type="button" disabled={!assignmentForm.employee_id || !assignmentForm.pattern_id} onClick={saveAssignment}>Asignar patron</Button>
              </div>
            </form>

            <div className="overflow-auto rounded-md border border-line bg-white shadow-subtle">
              <table className="min-w-[720px] w-full border-collapse text-sm">
                <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
                  <tr>
                    <th className="border-b border-line px-3 py-3">Empleado</th>
                    <th className="border-b border-line px-3 py-3">Patron</th>
                    <th className="border-b border-line px-3 py-3">Inicio</th>
                    <th className="border-b border-line px-3 py-3">Fin</th>
                    <th className="border-b border-line px-3 py-3">Dia ciclo</th>
                    <th className="border-b border-line px-3 py-3">Estado</th>
                    <th className="border-b border-line px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-3 font-medium">{employeeById.get(assignment.employee_id)?.name}</td>
                      <td className="px-3 py-3">{patternById.get(assignment.pattern_id)?.name}</td>
                      <td className="px-3 py-3">{assignment.start_date}</td>
                      <td className="px-3 py-3">{assignment.end_date ?? "-"}</td>
                      <td className="px-3 py-3">{assignment.start_day_index + 1}</td>
                      <td className="px-3 py-3">{assignment.is_active ? "Activa" : "Inactiva"}</td>
                      <td className="px-3 py-3 text-right">
                        {assignment.is_active ? <GhostButton type="button" onClick={() => deactivateAssignment(assignment)}>Desactivar</GhostButton> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
