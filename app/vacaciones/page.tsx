"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DepartmentBadge } from "@/components/department-badge";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Select, Textarea } from "@/components/ui";
import type { Absence, Department, Employee, ShiftType } from "@/lib/database.types";
import { ALL_DEPARTMENTS } from "@/lib/departments";
import { enumerateDates } from "@/lib/dates";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type AbsenceRow = Absence & {
  employees?: { name: string; department_id: string | null } | null;
  shift_types?: { code: string; name: string; color: string } | null;
};

const todayIso = new Date().toISOString().slice(0, 10);

export default function AbsencesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    employee_id: "",
    shift_type_id: "",
    start_date: todayIso,
    end_date: todayIso,
    notes: ""
  });

  async function loadData() {
    if (!supabase) return;
    const { data: employeeData } = await supabase.from("employees").select("*").eq("active", true).order("name");
    const { data: departmentData } = await supabase.from("departments").select("*").order("name");
    const { data: typeData } = await supabase.from("shift_types").select("*").order("code");
    const { data: absenceData, error } = await supabase
      .from("absences")
      .select("*, employees(name, department_id), shift_types(code, name, color)")
      .order("start_date", { ascending: false });
    if (error) setMessage(error.message);
    setEmployees(employeeData ?? []);
    setDepartments(departmentData ?? []);
    setShiftTypes(typeData ?? []);
    setAbsences((absenceData as AbsenceRow[]) ?? []);
    setForm((current) => ({
      ...current,
      employee_id: current.employee_id || employeeData?.[0]?.id || "",
      shift_type_id: current.shift_type_id || typeData?.find((type) => type.code === "V")?.id || typeData?.[0]?.id || ""
    }));
  }

  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const visibleEmployees = useMemo(() => (
    departmentFilter === ALL_DEPARTMENTS
      ? employees
      : employees.filter((employee) => employee.department_id === departmentFilter)
  ), [departmentFilter, employees]);
  const selectedEmployee = useMemo(() => employees.find((employee) => employee.id === form.employee_id) ?? null, [employees, form.employee_id]);
  const visibleShiftTypes = useMemo(() => (
    shiftTypes.filter((type) => !type.department_id || !selectedEmployee?.department_id || type.department_id === selectedEmployee.department_id)
  ), [selectedEmployee?.department_id, shiftTypes]);
  const visibleAbsences = useMemo(() => (
    departmentFilter === ALL_DEPARTMENTS
      ? absences
      : absences.filter((absence) => absence.employees?.department_id === departmentFilter)
  ), [absences, departmentFilter]);

  useEffect(() => {
    if (visibleEmployees.length > 0 && !visibleEmployees.some((employee) => employee.id === form.employee_id)) {
      setForm((current) => ({ ...current, employee_id: visibleEmployees[0].id }));
    }
  }, [departmentFilter, employees, form.employee_id, visibleEmployees]);

  useEffect(() => {
    if (visibleShiftTypes.length > 0 && !visibleShiftTypes.some((type) => type.id === form.shift_type_id)) {
      const vacationType = visibleShiftTypes.find((type) => type.code === "V");
      setForm((current) => ({ ...current, shift_type_id: vacationType?.id ?? visibleShiftTypes[0].id }));
    }
  }, [form.shift_type_id, selectedEmployee?.department_id, shiftTypes, visibleShiftTypes]);

  useEffect(() => {
    loadData();
  }, []);

  async function save() {
    if (!supabase) return;
    setMessage("");
    const payload = {
      employee_id: form.employee_id,
      shift_type_id: form.shift_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes.trim() || null
    };
    const { error } = await supabase.from("absences").insert(payload);
    if (error) {
      setMessage(error.message);
      return;
    }
    const assignments = enumerateDates(form.start_date, form.end_date).map((date) => ({
      employee_id: form.employee_id,
      date,
      shift_type_id: form.shift_type_id
    }));
    const upsertResult = await supabase.from("shift_assignments").upsert(assignments, { onConflict: "employee_id,date" });
    if (upsertResult.error) setMessage(upsertResult.error.message);
    setForm((current) => ({ ...current, notes: "" }));
    await loadData();
  }

  async function remove(absence: AbsenceRow) {
    if (!supabase) return;
    const { error } = await supabase.from("absences").delete().eq("id", absence.id);
    if (error) setMessage(error.message);
    await loadData();
  }

  return (
    <PageShell title="Vacaciones y ausencias" subtitle="Registra rangos y refleja sus turnos en la planilla.">
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para activar esta pantalla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      <div className="mb-5 rounded-md border border-line bg-white p-4 shadow-subtle">
        <Field label="Filtrar por departamento">
          <Select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value={ALL_DEPARTMENTS}>Todos los departamentos</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form className="rounded-md border border-line bg-white p-4 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
          <h3 className="mb-4 font-semibold">Nueva ausencia</h3>
          <div className="grid gap-3">
            <Field label="Empleado">
              <Select value={form.employee_id} onChange={(event) => setForm({ ...form, employee_id: event.target.value })}>
                {visibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={form.shift_type_id} onChange={(event) => setForm({ ...form, shift_type_id: event.target.value })}>
                {visibleShiftTypes.map((type) => <option key={type.id} value={type.id}>{type.code} · {type.name}</option>)}
              </Select>
            </Field>
            <Field label="Fecha inicio"><Input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></Field>
            <Field label="Fecha fin"><Input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></Field>
            <Field label="Notas"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            <Button type="button" disabled={!form.employee_id || !form.shift_type_id} onClick={save}>
              <Plus className="h-4 w-4" />
              Registrar
            </Button>
          </div>
        </form>

        <div className="overflow-auto rounded-md border border-line bg-white shadow-subtle">
          <table className="min-w-[760px] w-full border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
              <tr>
                <th className="border-b border-line px-3 py-3">Empleado</th>
                <th className="border-b border-line px-3 py-3">Departamento</th>
                <th className="border-b border-line px-3 py-3">Tipo</th>
                <th className="border-b border-line px-3 py-3">Inicio</th>
                <th className="border-b border-line px-3 py-3">Fin</th>
                <th className="border-b border-line px-3 py-3">Notas</th>
                <th className="border-b border-line px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {visibleAbsences.map((absence) => (
                <tr key={absence.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-medium">{absence.employees?.name}</td>
                  <td className="px-3 py-3"><DepartmentBadge department={departmentById.get(absence.employees?.department_id ?? "")} /></td>
                  <td className="px-3 py-3">
                    <span className="rounded px-2 py-1 font-semibold" style={{ backgroundColor: absence.shift_types?.color ?? "#eef2ef" }}>
                      {absence.shift_types?.code}
                    </span>
                    <span className="ml-2">{absence.shift_types?.name}</span>
                  </td>
                  <td className="px-3 py-3">{absence.start_date}</td>
                  <td className="px-3 py-3">{absence.end_date}</td>
                  <td className="px-3 py-3">{absence.notes ?? "-"}</td>
                  <td className="px-3 py-3 text-right">
                    <GhostButton type="button" onClick={() => remove(absence)}><Trash2 className="h-4 w-4" /></GhostButton>
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
