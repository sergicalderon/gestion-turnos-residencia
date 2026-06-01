"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Wand2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Select } from "@/components/ui";
import { ALL_DEPARTMENTS, departmentSlug, findDepartmentByParam } from "@/lib/departments";
import { monthDays, monthLabel, monthRange } from "@/lib/dates";
import { assignmentHours, workloadTargetForExactRange, workloadTargetForRange } from "@/lib/hours";
import type { Department, Employee, EmployeeWorkloadPeriod, ShiftAssignment, ShiftType } from "@/lib/database.types";
import { generateShiftsFromPatterns } from "@/lib/pattern-generation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function SchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(ALL_DEPARTMENTS);
  const [workloadPeriods, setWorkloadPeriods] = useState<EmployeeWorkloadPeriod[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [monthAssignments, setMonthAssignments] = useState<ShiftAssignment[]>([]);
  const [yearAssignments, setYearAssignments] = useState<ShiftAssignment[]>([]);
  const [message, setMessage] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    start_date: "",
    end_date: "",
    allEmployees: true,
    employeeIds: [] as string[],
    overwriteExisting: false
  });

  const days = useMemo(() => monthDays(year, month), [year, month]);
  const range = useMemo(() => monthRange(year, month), [year, month]);
  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );

  const visibleEmployees = useMemo(() => {
    if (selectedDepartmentId === ALL_DEPARTMENTS) return employees;
    return employees.filter((employee) => employee.department_id === selectedDepartmentId);
  }, [employees, selectedDepartmentId]);

  const assignmentByCell = useMemo(() => {
    return new Map(monthAssignments.map((assignment) => [`${assignment.employee_id}-${assignment.date}`, assignment]));
  }, [monthAssignments]);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setMessage("");
    const yearStart = `${year}-01-01`;
    const { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("active", true)
      .lte("start_date", range.endIso)
      .or(`end_date.is.null,end_date.gte.${range.startIso}`)
      .order("name");
    const { data: workloadData, error: workloadError } = await supabase
      .from("employee_workload_periods")
      .select("*")
      .lte("start_date", range.endIso)
      .or(`end_date.is.null,end_date.gte.${yearStart}`)
      .order("start_date");
    const { data: typeData, error: typeError } = await supabase.from("shift_types").select("*").order("code");
    const { data: departmentData, error: departmentError } = await supabase.from("departments").select("*").order("name");
    const { data: monthData, error: monthError } = await supabase
      .from("shift_assignments")
      .select("*")
      .gte("date", range.startIso)
      .lte("date", range.endIso);
    const { data: yearData, error: yearError } = await supabase
      .from("shift_assignments")
      .select("*")
      .gte("date", yearStart)
      .lte("date", range.endIso);

    const error = employeeError ?? workloadError ?? typeError ?? departmentError ?? monthError ?? yearError;
    if (error) setMessage(error.message);
    setEmployees(employeeData ?? []);
    const nextDepartments = departmentData ?? [];
    setDepartments(nextDepartments);
    const requestedDepartment = findDepartmentByParam(nextDepartments, searchParams.get("department"));
    setSelectedDepartmentId((current) => current === ALL_DEPARTMENTS && requestedDepartment ? requestedDepartment.id : current);
    setWorkloadPeriods(workloadData ?? []);
    setShiftTypes(typeData ?? []);
    setMonthAssignments(monthData ?? []);
    setYearAssignments(yearData ?? []);
  }, [range.endIso, range.startIso, searchParams, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setGenerateForm((current) => ({
      ...current,
      start_date: range.startIso,
      end_date: range.endIso
    }));
  }, [range.endIso, range.startIso]);

  function moveMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  function changeDepartment(departmentId: string) {
    setSelectedDepartmentId(departmentId);
    if (departmentId === ALL_DEPARTMENTS) {
      router.replace("/");
      return;
    }
    const department = departments.find((item) => item.id === departmentId);
    router.replace(`/?department=${departmentSlug(department?.name ?? departmentId)}`);
  }

  function shiftTypeOptionsFor(employee: Employee, currentShiftTypeId?: string) {
    const options = selectedDepartmentId === ALL_DEPARTMENTS
      ? shiftTypes
      : shiftTypes.filter((type) => !type.department_id || type.department_id === employee.department_id);
    if (currentShiftTypeId && !options.some((type) => type.id === currentShiftTypeId)) {
      const currentType = shiftTypes.find((type) => type.id === currentShiftTypeId);
      return currentType ? [...options, currentType] : options;
    }
    return options;
  }

  async function saveAssignment(employeeId: string, date: string, shiftTypeId: string) {
    if (!supabase) return;
    const key = `${employeeId}-${date}`;
    setSavingCell(key);
    if (!shiftTypeId) {
      const existing = assignmentByCell.get(key);
      if (existing) await supabase.from("shift_assignments").delete().eq("id", existing.id);
    } else {
      await supabase.from("shift_assignments").upsert(
        {
          employee_id: employeeId,
          date,
          shift_type_id: shiftTypeId,
          source: "manual",
          employee_shift_pattern_id: null,
          generated_at: null
        },
        { onConflict: "employee_id,date" }
      );
    }
    await loadData();
    setSavingCell(null);
  }

  async function generatePatternAssignments() {
    if (!supabase) return;
    setGenerating(true);
    setMessage("");
    try {
      const result = await generateShiftsFromPatterns(supabase, {
        startDate: generateForm.start_date,
        endDate: generateForm.end_date,
        employeeIds: generateForm.allEmployees ? visibleEmployees.map((employee) => employee.id) : generateForm.employeeIds,
        overwriteExisting: generateForm.overwriteExisting
      });
      setMessage(`Generados ${result.generated} turnos. Omitidos por existentes: ${result.skippedExisting}.`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron generar los turnos.");
    } finally {
      setGenerating(false);
    }
  }

  function employeeSummary(employee: Employee) {
    const monthRows = monthAssignments.filter((assignment) => assignment.employee_id === employee.id);
    const yearRows = yearAssignments.filter((assignment) => assignment.employee_id === employee.id);
    const monthHours = assignmentHours(monthRows, shiftTypes);
    const yearHours = assignmentHours(yearRows, shiftTypes);
    const employeePeriods = workloadPeriods.filter((period) => period.employee_id === employee.id);
    const monthTarget = workloadTargetForExactRange(employee, employeePeriods, year, range.startIso, range.endIso);
    const target = workloadTargetForRange(employee, employeePeriods, year, range.endIso);
    return {
      monthHours,
      yearHours,
      monthTarget: monthTarget.target,
      target: target.target,
      hasMissingWorkload: monthTarget.missingRanges.length > 0 || target.missingRanges.length > 0,
      diff: yearHours - target.target
    };
  }

  return (
    <PageShell
      title="Planilla mensual"
      subtitle="Vista tipo Excel para asignar turnos y controlar horas."
      actions={
        <>
          <GhostButton type="button" onClick={() => moveMonth(-1)}><ChevronLeft className="h-4 w-4" /></GhostButton>
          <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold capitalize shadow-subtle">
            {monthLabel(year, month)}
          </div>
          <GhostButton type="button" onClick={() => moveMonth(1)}><ChevronRight className="h-4 w-4" /></GhostButton>
          <Select value={year} onChange={(event) => setYear(Number(event.target.value))} className="w-28">
            {Array.from({ length: 7 }, (_, index) => today.getFullYear() - 3 + index).map((optionYear) => (
              <option key={optionYear} value={optionYear}>{optionYear}</option>
            ))}
          </Select>
          <Select value={selectedDepartmentId} onChange={(event) => changeDepartment(event.target.value)} className="w-56">
            <option value={ALL_DEPARTMENTS}>Todos los departamentos</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
          <Button type="button" onClick={() => setShowGenerate((current) => !current)}><Wand2 className="h-4 w-4" />Generar turnos desde patrones</Button>
          <GhostButton type="button" onClick={loadData}><RefreshCw className="h-4 w-4" /></GhostButton>
        </>
      }
    >
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para cargar y guardar la planilla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      {showGenerate ? (
        <div className="mb-5 rounded-md border border-line bg-white p-4 shadow-subtle">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Generar turnos desde patrones</h3>
            <GhostButton type="button" onClick={() => setShowGenerate(false)}>Cerrar</GhostButton>
          </div>
          <div className="grid gap-4 lg:grid-cols-[180px_180px_1fr_auto] lg:items-end">
            <Field label="Fecha inicio">
              <Input type="date" value={generateForm.start_date} onChange={(event) => setGenerateForm({ ...generateForm, start_date: event.target.value })} />
            </Field>
            <Field label="Fecha fin">
              <Input type="date" value={generateForm.end_date} onChange={(event) => setGenerateForm({ ...generateForm, end_date: event.target.value })} />
            </Field>
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={generateForm.allEmployees} onChange={(event) => setGenerateForm({ ...generateForm, allEmployees: event.target.checked })} />
                Todos los empleados activos con patron asignado
              </label>
              {!generateForm.allEmployees ? (
                <div className="grid max-h-36 gap-2 overflow-auto rounded-md border border-line p-2">
                  {visibleEmployees.map((employee) => (
                    <label key={employee.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={generateForm.employeeIds.includes(employee.id)}
                        onChange={(event) => {
                          const employeeIds = event.target.checked
                            ? [...generateForm.employeeIds, employee.id]
                            : generateForm.employeeIds.filter((id) => id !== employee.id);
                          setGenerateForm({ ...generateForm, employeeIds });
                        }}
                      />
                      {employee.name}
                    </label>
                  ))}
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={generateForm.overwriteExisting} onChange={(event) => setGenerateForm({ ...generateForm, overwriteExisting: event.target.checked })} />
                Sobrescribir turnos existentes
              </label>
            </div>
            <Button
              type="button"
              disabled={generating || !generateForm.start_date || !generateForm.end_date || (!generateForm.allEmployees && generateForm.employeeIds.length === 0)}
              onClick={generatePatternAssignments}
            >
              <Wand2 className="h-4 w-4" />
              Generar
            </Button>
          </div>
        </div>
      ) : null}
      <div className="spreadsheet-scroll overflow-auto rounded-md border border-line bg-white shadow-subtle">
        <table className="w-full min-w-[1280px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper">
              <th className="sticky left-0 z-20 min-w-52 border-b border-r border-line bg-paper px-3 py-2 text-left">Empleado</th>
              {days.map((day) => (
                <th key={day.iso} className="min-w-14 border-b border-r border-line px-1 py-2 text-center">
                  <span className="block text-xs uppercase text-moss">{day.weekday}</span>
                  <span className="font-semibold">{day.day}</span>
                </th>
              ))}
              <th className="min-w-28 border-b border-r border-line px-3 py-2 text-right">Mes</th>
              <th className="min-w-32 border-b border-r border-line px-3 py-2 text-right">Año</th>
              <th className="min-w-32 border-b border-line px-3 py-2 text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((employee) => {
              const summary = employeeSummary(employee);
              return (
                <tr key={employee.id} className="border-b border-line last:border-0">
                  <th className="sticky left-0 z-10 border-r border-line bg-white px-3 py-2 text-left font-semibold">
                    <span className="block">{employee.name}</span>
                    <span className="text-xs font-normal text-moss">{selectedDepartmentId === ALL_DEPARTMENTS ? departments.find((department) => department.id === employee.department_id)?.name ?? "Sin departamento" : selectedDepartment?.name ?? "Sin departamento"}</span>
                  </th>
                  {days.map((day) => {
                    const key = `${employee.id}-${day.iso}`;
                    const assignment = assignmentByCell.get(key);
                    const shiftType = shiftTypes.find((item) => item.id === assignment?.shift_type_id);
                    return (
                      <td key={day.iso} className="border-r border-line p-0" style={{ backgroundColor: shiftType?.color ?? "white" }}>
                        <select
                          aria-label={`${employee.name} ${day.iso}`}
                          className="h-10 w-full min-w-14 bg-transparent px-1 text-center text-xs font-bold outline-none"
                          value={assignment?.shift_type_id ?? ""}
                          disabled={savingCell === key}
                          onChange={(event) => saveAssignment(employee.id, day.iso, event.target.value)}
                        >
                          <option value=""></option>
                          {shiftTypeOptionsFor(employee, assignment?.shift_type_id).map((type) => (
                            <option key={type.id} value={type.id}>{type.code}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td className="border-r border-line px-3 py-2 text-right">{summary.monthHours.toFixed(1)} / {summary.monthTarget.toFixed(1)}</td>
                  <td className="border-r border-line px-3 py-2 text-right">{summary.yearHours.toFixed(1)} / {summary.target.toFixed(1)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${summary.diff >= 0 ? "text-moss" : "text-coral"}`}>
                    {summary.diff >= 0 ? "+" : ""}{summary.diff.toFixed(1)} h
                    {summary.hasMissingWorkload ? <div className="text-xs font-normal text-coral">Sin jornada definida</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleEmployees.length === 0 ? <div className="px-4 py-8 text-center text-sm text-moss">No hay empleados activos para este mes.</div> : null}
      </div>
    </PageShell>
  );
}
