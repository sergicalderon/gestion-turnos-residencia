"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Wand2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Select } from "@/components/ui";
import { ALL_DEPARTMENTS, departmentSlug, findDepartmentByParam } from "@/lib/departments";
import { monthDays, monthLabel, monthRange } from "@/lib/dates";
import { assignmentHours, operationalMonthlyTarget } from "@/lib/hours";
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
  const [message, setMessage] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
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
  const scheduleTableStyle = {
    "--day-count": days.length,
    "--schedule-zoom": zoom
  } as CSSProperties;

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
      .or(`end_date.is.null,end_date.gte.${range.startIso}`)
      .order("start_date");
    const { data: typeData, error: typeError } = await supabase.from("shift_types").select("*").order("code");
    const { data: departmentData, error: departmentError } = await supabase.from("departments").select("*").order("name");
    const { data: monthData, error: monthError } = await supabase
      .from("shift_assignments")
      .select("*")
      .gte("date", range.startIso)
      .lte("date", range.endIso);

    const error = employeeError ?? workloadError ?? typeError ?? departmentError ?? monthError;
    if (error) setMessage(error.message);
    setEmployees(employeeData ?? []);
    const nextDepartments = departmentData ?? [];
    setDepartments(nextDepartments);
    const requestedDepartment = findDepartmentByParam(nextDepartments, searchParams.get("department"));
    setSelectedDepartmentId((current) => current === ALL_DEPARTMENTS && requestedDepartment ? requestedDepartment.id : current);
    setWorkloadPeriods(workloadData ?? []);
    setShiftTypes(typeData ?? []);
    setMonthAssignments(monthData ?? []);
  }, [range.endIso, range.startIso, searchParams]);

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
    const monthHours = assignmentHours(monthRows, shiftTypes);
    const employeePeriods = workloadPeriods.filter((period) => period.employee_id === employee.id);
    const monthTarget = operationalMonthlyTarget(employee, employeePeriods, range.startIso, range.endIso);
    return {
      monthHours,
      monthTarget: monthTarget.target,
      hasMissingWorkload: monthTarget.missingRanges.length > 0,
      diff: monthHours - monthTarget.target
    };
  }

  return (
    <PageShell
      title="Planilla mensual"
      subtitle="Vista tipo Excel para asignar turnos y controlar horas."
      actions={
        <>
          <div className="flex items-center overflow-hidden rounded-md border border-line bg-white shadow-subtle">
            <GhostButton type="button" onClick={() => moveMonth(-1)} className="min-h-9 rounded-none border-0 border-r border-line px-2 shadow-none"><ChevronLeft className="h-4 w-4" /></GhostButton>
            <div className="min-w-36 px-3 text-center text-sm font-semibold capitalize">
              {monthLabel(year, month)}
            </div>
            <GhostButton type="button" onClick={() => moveMonth(1)} className="min-h-9 rounded-none border-0 border-l border-line px-2 shadow-none"><ChevronRight className="h-4 w-4" /></GhostButton>
          </div>
          <Select value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-9 w-24">
            {Array.from({ length: 7 }, (_, index) => today.getFullYear() - 3 + index).map((optionYear) => (
              <option key={optionYear} value={optionYear}>{optionYear}</option>
            ))}
          </Select>
          <Select value={selectedDepartmentId} onChange={(event) => changeDepartment(event.target.value)} className="h-9 w-52">
            <option value={ALL_DEPARTMENTS}>Todos los departamentos</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
          <div className="flex items-center overflow-hidden rounded-md border border-line bg-white shadow-subtle" aria-label="Zoom de planilla">
            {[0.8, 1, 1.2].map((option) => (
              <button
                key={option}
                type="button"
                className={`min-h-9 px-2.5 text-xs font-semibold transition ${zoom === option ? "bg-ink text-white" : "text-moss hover:bg-paper hover:text-ink"}`}
                onClick={() => setZoom(option)}
              >
                {Math.round(option * 100)}%
              </button>
            ))}
          </div>
          <Button type="button" onClick={() => setShowGenerate((current) => !current)} className="min-h-9 px-3"><Wand2 className="h-4 w-4" />Generar</Button>
          <GhostButton type="button" onClick={loadData} className="min-h-9 px-2.5"><RefreshCw className="h-4 w-4" /></GhostButton>
        </>
      }
    >
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para cargar y guardar la planilla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      {showGenerate ? (
        <div className="mb-3 rounded-md border border-line bg-white p-3 shadow-subtle">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Generar turnos desde patrones</h3>
            <GhostButton type="button" onClick={() => setShowGenerate(false)} className="min-h-9">Cerrar</GhostButton>
          </div>
          <div className="grid gap-3 lg:grid-cols-[160px_160px_minmax(300px,1fr)_auto] lg:items-end">
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
      <div className="spreadsheet-scroll schedule-shell overflow-x-auto overflow-y-auto rounded-md border border-line bg-white shadow-subtle">
        <table className="schedule-table w-full border-collapse text-sm" style={scheduleTableStyle}>
          <colgroup>
            <col className="schedule-employee-col" />
            {days.map((day) => <col key={day.iso} className="schedule-day-col" />)}
            <col className="schedule-summary-col schedule-total-col" />
            <col className="schedule-summary-col schedule-diff-col" />
          </colgroup>
          <thead>
            <tr className="bg-paper">
              <th className="schedule-employee-header sticky left-0 top-0 z-30 border-b border-r border-line bg-paper px-2 text-left">Empleado</th>
              {days.map((day) => (
                <th key={day.iso} className="schedule-day-header sticky top-0 z-20 border-b border-r border-line bg-paper px-0.5 text-center">
                  <span className="block text-xs uppercase text-moss">{day.weekday}</span>
                  <span className="font-semibold">{day.day}</span>
                </th>
              ))}
              <th className="schedule-summary-header sticky top-0 z-20 border-b border-r border-line bg-paper px-3 text-right">Mes</th>
              <th className="schedule-summary-header sticky top-0 z-20 border-b border-line bg-paper px-3 text-right">Dif.</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((employee) => {
              const summary = employeeSummary(employee);
              return (
                <tr key={employee.id} className="border-b border-line last:border-0">
                  <th className="schedule-employee-cell sticky left-0 z-10 border-r border-line bg-white px-2 text-left font-semibold">
                    <span className="block truncate">{employee.name}</span>
                    <span className="block truncate text-xs font-normal text-moss">{selectedDepartmentId === ALL_DEPARTMENTS ? departments.find((department) => department.id === employee.department_id)?.name ?? "Sin departamento" : selectedDepartment?.name ?? "Sin departamento"}</span>
                    <span className="schedule-mobile-summary mt-1 block text-xs font-normal text-ink lg:hidden">
                      <span>Mes: {summary.monthHours.toFixed(1)} / {summary.monthTarget.toFixed(1)}</span>
                      <span className={summary.diff >= 0 ? "text-moss" : "text-coral"}>
                        Dif.: {summary.diff >= 0 ? "+" : ""}{summary.diff.toFixed(1)} h
                      </span>
                    </span>
                  </th>
                  {days.map((day) => {
                    const key = `${employee.id}-${day.iso}`;
                    const assignment = assignmentByCell.get(key);
                    const shiftType = shiftTypes.find((item) => item.id === assignment?.shift_type_id);
                    return (
                      <td key={day.iso} className="schedule-day-cell border-r border-line p-0" style={{ backgroundColor: shiftType?.color ?? "white" }}>
                        <select
                          aria-label={`${employee.name} ${day.iso}`}
                          className="h-full w-full appearance-none bg-transparent px-0.5 text-center text-xs font-bold outline-none"
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
                  <td className="schedule-summary-cell border-r border-line px-3 text-right">{summary.monthHours.toFixed(1)} / {summary.monthTarget.toFixed(1)}</td>
                  <td className={`schedule-summary-cell px-3 text-right font-semibold ${summary.diff >= 0 ? "text-moss" : "text-coral"}`}>
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
