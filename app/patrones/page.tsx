"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Select, Textarea } from "@/components/ui";
import { ALL_DEPARTMENTS } from "@/lib/departments";
import type { Department, Employee, EmployeeShiftPattern, ShiftPattern, ShiftPatternDay, ShiftType } from "@/lib/database.types";
import {
  patternCycleStats,
  simulatePatternYear,
  workloadEquivalenceLabel,
  workloadEquivalencePercentage,
  type WorkloadEquivalenceLabel
} from "@/lib/pattern-analytics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

const todayIso = new Date().toISOString().slice(0, 10);
const currentYear = new Date().getFullYear();

type PatternForm = {
  name: string;
  description: string;
  is_active: boolean;
  department_id: string;
  days: string[];
};

const emptyPattern: PatternForm = {
  name: "",
  description: "",
  is_active: true,
  department_id: "",
  days: []
};

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [patternDays, setPatternDays] = useState<ShiftPatternDay[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);
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
  const [simulationForm, setSimulationForm] = useState({
    year: currentYear,
    start_date: `${currentYear}-01-01`,
    start_day_index: 1,
    full_time_annual_hours: 1772,
    range_mode: "year" as "year" | "custom",
    custom_start_date: `${currentYear}-01-01`,
    custom_end_date: `${currentYear}-12-31`
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const shiftTypeById = useMemo(() => new Map(shiftTypes.map((type) => [type.id, type])), [shiftTypes]);
  const patternDaysById = useMemo(() => {
    const daysById = new Map<string, ShiftPatternDay[]>();
    for (const day of patternDays) {
      const days = daysById.get(day.pattern_id) ?? [];
      days.push(day);
      daysById.set(day.pattern_id, days);
    }
    return daysById;
  }, [patternDays]);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const patternById = useMemo(() => new Map(patterns.map((pattern) => [pattern.id, pattern])), [patterns]);
  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const visibleEmployees = useMemo(() => {
    if (departmentFilter === ALL_DEPARTMENTS) return employees;
    return employees.filter((employee) => employee.department_id === departmentFilter);
  }, [departmentFilter, employees]);
  const visiblePatterns = useMemo(() => {
    if (departmentFilter === ALL_DEPARTMENTS) return patterns;
    return patterns.filter((pattern) => !pattern.department_id || pattern.department_id === departmentFilter);
  }, [departmentFilter, patterns]);
  const patternShiftTypes = useMemo(() => {
    return shiftTypes.filter((type) => !type.department_id || !patternForm.department_id || type.department_id === patternForm.department_id);
  }, [patternForm.department_id, shiftTypes]);
  const selectedAssignmentEmployee = useMemo(
    () => employees.find((employee) => employee.id === assignmentForm.employee_id) ?? null,
    [assignmentForm.employee_id, employees]
  );
  const assignmentPatterns = useMemo(() => {
    return patterns.filter((pattern) => !pattern.department_id || !selectedAssignmentEmployee?.department_id || pattern.department_id === selectedAssignmentEmployee.department_id);
  }, [patterns, selectedAssignmentEmployee?.department_id]);
  const visibleAssignments = useMemo(() => {
    if (departmentFilter === ALL_DEPARTMENTS) return assignments;
    return assignments.filter((assignment) => employeeById.get(assignment.employee_id)?.department_id === departmentFilter);
  }, [assignments, departmentFilter, employeeById]);
  const simulationParams = useMemo(() => ({
    year: Number(simulationForm.year),
    startDate: simulationForm.start_date,
    startDayIndex: Math.max(0, Number(simulationForm.start_day_index) - 1),
    fullTimeAnnualHours: Number(simulationForm.full_time_annual_hours),
    rangeMode: simulationForm.range_mode,
    customStartDate: simulationForm.custom_start_date,
    customEndDate: simulationForm.custom_end_date
  }), [simulationForm]);
  const selectedPatternDays = useMemo(
    () => (selectedPatternId ? patternDaysById.get(selectedPatternId) ?? [] : []),
    [patternDaysById, selectedPatternId]
  );
  const formStats = useMemo(() => {
    const formDays = patternForm.days.map((shiftTypeId, index) => ({
      id: `${index}`,
      pattern_id: selectedPatternId ?? "form",
      day_index: index,
      shift_type_id: shiftTypeId,
      created_at: "",
      updated_at: ""
    }));
    return patternCycleStats(formDays, shiftTypeById, Number(simulationForm.year));
  }, [patternForm.days, selectedPatternId, shiftTypeById, simulationForm.year]);
  const selectedStats = useMemo(
    () => patternCycleStats(selectedPatternDays, shiftTypeById, Number(simulationForm.year)),
    [selectedPatternDays, shiftTypeById, simulationForm.year]
  );
  const selectedSimulation = useMemo(
    () => simulatePatternYear(selectedPatternDays, shiftTypeById, simulationParams),
    [selectedPatternDays, shiftTypeById, simulationParams]
  );
  const formEquivalence = workloadEquivalencePercentage(formStats.theoreticalAnnualHours, Number(simulationForm.full_time_annual_hours));
  const selectedTheoreticalEquivalence = workloadEquivalencePercentage(selectedStats.theoreticalAnnualHours, Number(simulationForm.full_time_annual_hours));
  const selectedSimulationEquivalence = workloadEquivalencePercentage(selectedSimulation.totalHours, Number(simulationForm.full_time_annual_hours));

  async function loadData() {
    if (!supabase) return;
    setMessage("");
    const [
      { data: patternData, error: patternError },
      { data: dayData, error: dayError },
      { data: shiftTypeData, error: shiftTypeError },
      { data: departmentData, error: departmentError },
      { data: employeeData, error: employeeError },
      { data: assignmentData, error: assignmentError }
    ] = await Promise.all([
      supabase.from("shift_patterns").select("*").order("name"),
      supabase.from("shift_pattern_days").select("*").order("day_index"),
      supabase.from("shift_types").select("*").order("code"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("employees").select("*").order("name"),
      supabase.from("employee_shift_patterns").select("*").order("start_date", { ascending: false })
    ]);
    const error = patternError ?? dayError ?? shiftTypeError ?? departmentError ?? employeeError ?? assignmentError;
    if (error) setMessage(error.message);
    setPatterns(patternData ?? []);
    setPatternDays(dayData ?? []);
    setShiftTypes(shiftTypeData ?? []);
    setDepartments(departmentData ?? []);
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
      department_id: pattern.department_id ?? "",
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
      is_active: patternForm.is_active,
      department_id: patternForm.department_id || null
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
  const yearStart = `${simulationForm.year}-01-01`;
  const yearEnd = `${simulationForm.year}-12-31`;

  return (
    <PageShell title="Patrones de turno" subtitle="Ciclos repetitivos y asignacion a empleados.">
      {!isSupabaseConfigured ? <Notice>Configura Supabase para usar patrones.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      <div className="mb-5 rounded-md border border-line bg-white p-4 shadow-subtle">
        <Field label="Filtrar por departamento">
          <Select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value={ALL_DEPARTMENTS}>Todos los departamentos</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Listado</h3>
            <GhostButton type="button" onClick={resetPattern}><Plus className="h-4 w-4" />Nuevo</GhostButton>
          </div>
          {visiblePatterns.map((pattern) => {
            const days = patternDaysById.get(pattern.id) ?? [];
            const stats = patternCycleStats(days, shiftTypeById, Number(simulationForm.year));
            const simulation = simulatePatternYear(days, shiftTypeById, simulationParams);
            const equivalence = workloadEquivalencePercentage(stats.theoreticalAnnualHours, Number(simulationForm.full_time_annual_hours));
            const equivalenceLabel = workloadEquivalenceLabel(equivalence);
            return (
              <button
                key={pattern.id}
                type="button"
                className="rounded-md border border-line bg-white p-3 text-left shadow-subtle hover:bg-paper"
                onClick={() => selectPattern(pattern)}
              >
                <span className="block font-semibold">{pattern.name}</span>
                <span className="text-sm text-moss">{departmentById.get(pattern.department_id ?? "")?.name ?? "Global"} · {stats.cycleDays} dias · {pattern.is_active ? "Activo" : "Inactivo"}</span>
                <span className="mt-2 block truncate text-xs text-ink">{stats.sequence || "Sin secuencia"}</span>
                <span className="mt-2 grid grid-cols-2 gap-1 text-xs text-moss">
                  <span>{formatHours(stats.theoreticalAnnualHours)} h/año</span>
                  <span>{formatPercent(equivalence)} jornada</span>
                  <span>{formatHours(stats.hoursPerCycle)} h/ciclo</span>
                  <span>{stats.workedShiftsPerCycle} trabajados</span>
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <EquivalenceBadge label={equivalenceLabel} />
                  <span className="text-moss">{formatHours(simulation.totalHours)} h simuladas</span>
                </span>
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
              <Field label="Departamento">
                <Select value={patternForm.department_id} onChange={(event) => setPatternForm({ ...patternForm, department_id: event.target.value })}>
                  <option value="">Global</option>
                  {departments.filter((department) => department.is_active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </Select>
              </Field>
              <Field label="Descripcion"><Textarea value={patternForm.description} onChange={(event) => setPatternForm({ ...patternForm, description: event.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={patternForm.is_active} onChange={(event) => setPatternForm({ ...patternForm, is_active: event.target.checked })} />
                Activo
              </label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Dias del ciclo</span>
                  <GhostButton type="button" onClick={() => setPatternForm({ ...patternForm, days: [...patternForm.days, patternShiftTypes[0]?.id ?? ""] })}>Añadir dia</GhostButton>
                </div>
                {patternForm.days.map((shiftTypeId, index) => (
                  <div key={`${index}-${shiftTypeId}`} className="grid grid-cols-[72px_1fr_auto] items-center gap-2">
                    <span className="text-sm text-moss">Dia {index + 1}</span>
                    <Select value={shiftTypeId} onChange={(event) => updateDay(index, event.target.value)}>
                      {patternShiftTypes.map((type) => <option key={type.id} value={type.id}>{type.code} · {type.name}</option>)}
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
              <div className="grid gap-3 rounded-md border border-line bg-paper p-3 text-sm">
                <div className="font-semibold">Computo del ciclo</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Metric label="Secuencia" value={formStats.sequence || "-"} />
                  <Metric label="Dias del ciclo" value={`${formStats.cycleDays}`} />
                  <Metric label="Turnos trabajados por ciclo" value={`${formStats.workedShiftsPerCycle}`} />
                  <Metric label="Horas computables por ciclo" value={`${formatHours(formStats.hoursPerCycle)} h`} />
                  <Metric label="Horas anuales estimadas" value={`${formatHours(formStats.theoreticalAnnualHours)} h`} />
                  <Metric label="Equivalencia jornada" value={formatPercent(formEquivalence)} />
                </div>
                <EquivalenceBadge label={workloadEquivalenceLabel(formEquivalence)} />
              </div>
              <Button type="button" disabled={saving} onClick={savePattern}><Save className="h-4 w-4" />Guardar patron</Button>
            </div>
          </form>

          <div className="rounded-md border border-line bg-white p-4 shadow-subtle">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Simulacion exacta</h3>
              <span className="text-xs font-medium text-moss">Equivalencia informativa, sin crear turnos reales</span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Año seleccionado">
                <Input
                  type="number"
                  min="2000"
                  max="2100"
                  value={simulationForm.year}
                  onChange={(event) => {
                    const year = Number(event.target.value);
                    setSimulationForm({
                      ...simulationForm,
                      year,
                      custom_start_date: `${year}-01-01`,
                      custom_end_date: `${year}-12-31`
                    });
                  }}
                />
              </Field>
              <Field label="Fecha de inicio del patron">
                <Input type="date" value={simulationForm.start_date} onChange={(event) => setSimulationForm({ ...simulationForm, start_date: event.target.value })} />
              </Field>
              <Field label="Dia inicial del ciclo">
                <Input type="number" min="1" value={simulationForm.start_day_index} onChange={(event) => setSimulationForm({ ...simulationForm, start_day_index: Number(event.target.value) })} />
              </Field>
              <Field label="Horas anuales jornada completa">
                <Input type="number" min="0" step="0.01" value={simulationForm.full_time_annual_hours} onChange={(event) => setSimulationForm({ ...simulationForm, full_time_annual_hours: Number(event.target.value) })} />
              </Field>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr_1fr]">
              <Field label="Periodo">
                <Select value={simulationForm.range_mode} onChange={(event) => setSimulationForm({ ...simulationForm, range_mode: event.target.value as "year" | "custom" })}>
                  <option value="year">Año completo</option>
                  <option value="custom">Rango personalizado</option>
                </Select>
              </Field>
              <Field label="Desde">
                <Input
                  type="date"
                  value={simulationForm.range_mode === "year" ? yearStart : simulationForm.custom_start_date}
                  disabled={simulationForm.range_mode === "year"}
                  onChange={(event) => setSimulationForm({ ...simulationForm, custom_start_date: event.target.value })}
                />
              </Field>
              <Field label="Hasta">
                <Input
                  type="date"
                  value={simulationForm.range_mode === "year" ? yearEnd : simulationForm.custom_end_date}
                  disabled={simulationForm.range_mode === "year"}
                  onChange={(event) => setSimulationForm({ ...simulationForm, custom_end_date: event.target.value })}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
              <div className="grid gap-2 rounded-md border border-line bg-paper p-3 text-sm">
                <div className="font-semibold">{selectedPatternId ? patternById.get(selectedPatternId)?.name : "Selecciona un patron"}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Metric label="Secuencia del patron" value={selectedStats.sequence || "-"} />
                  <Metric label="Numero de dias del ciclo" value={`${selectedStats.cycleDays}`} />
                  <Metric label="Turnos trabajados por ciclo" value={`${selectedStats.workedShiftsPerCycle}`} />
                  <Metric label="Horas computables por ciclo" value={`${formatHours(selectedStats.hoursPerCycle)} h`} />
                  <Metric label="Horas anuales estimadas" value={`${formatHours(selectedStats.theoreticalAnnualHours)} h`} />
                  <Metric label="Equivalencia jornada" value={formatPercent(selectedTheoreticalEquivalence)} />
                </div>
                <EquivalenceBadge label={workloadEquivalenceLabel(selectedTheoreticalEquivalence)} />
              </div>
              <div className="grid gap-2 rounded-md border border-line bg-paper p-3 text-sm">
                <div className="font-semibold">Resultado simulado</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Metric label="Rango" value={`${selectedSimulation.rangeStart || "-"} / ${selectedSimulation.rangeEnd || "-"}`} />
                  <Metric label="Horas totales" value={`${formatHours(selectedSimulation.totalHours)} h`} />
                  <Metric label="Dias trabajados" value={`${selectedSimulation.workedDays}`} />
                  <Metric label="Dias libres" value={`${selectedSimulation.freeDays}`} />
                  <Metric label="Equivalencia simulada" value={formatPercent(selectedSimulationEquivalence)} />
                  <Metric label="Diferencia jornada completa" value={formatSignedHours(selectedSimulation.differenceFromFullTimeAnnualHours)} />
                </div>
                <EquivalenceBadge label={workloadEquivalenceLabel(selectedSimulationEquivalence)} />
              </div>
            </div>
            <p className="mt-3 text-xs text-moss">
              Esta equivalencia no sustituye el historico de jornadas del empleado.
            </p>
            <div className="mt-3 rounded-md border border-line bg-white p-3">
              <div className="mb-2 text-sm font-semibold">Apariciones por tipo de turno</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedSimulation.countsByShiftTypeId).length ? Object.entries(selectedSimulation.countsByShiftTypeId)
                  .sort(([first], [second]) => (shiftTypeById.get(first)?.code ?? "").localeCompare(shiftTypeById.get(second)?.code ?? ""))
                  .map(([shiftTypeId, count]) => {
                    const shiftType = shiftTypeById.get(shiftTypeId);
                    return (
                      <span key={shiftTypeId} className="rounded-md border border-line px-2 py-1 text-xs font-medium">
                        {shiftType?.code ?? "?"}: {count}
                      </span>
                    );
                  }) : <span className="text-sm text-moss">No hay datos para simular.</span>}
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <form className="rounded-md border border-line bg-white p-4 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
              <h3 className="mb-4 font-semibold">Asignar a empleado</h3>
              <div className="grid gap-3">
                <Field label="Empleado">
                  <Select value={assignmentForm.employee_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, employee_id: event.target.value })}>
                    {visibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                  </Select>
                </Field>
                <Field label="Patron">
                  <Select value={assignmentForm.pattern_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, pattern_id: event.target.value })}>
                    {assignmentPatterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
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
                  {visibleAssignments.map((assignment) => (
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

function formatHours(value: number) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatSignedHours(value: number) {
  const formatted = formatHours(Math.abs(value));
  if (value > 0) return `+${formatted} h`;
  if (value < 0) return `-${formatted} h`;
  return "0 h";
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 1
  }).format(value)}%`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-moss">{label}</div>
      <div className="break-words font-semibold text-ink">{value}</div>
    </div>
  );
}

function EquivalenceBadge({ label }: { label: WorkloadEquivalenceLabel }) {
  const classNameByLabel: Record<WorkloadEquivalenceLabel, string> = {
    parcial: "border-line bg-white text-moss",
    "parcial alta": "border-saffron/40 bg-[#fff7df] text-ink",
    "jornada completa": "border-mint bg-mint text-ink",
    "exceso de jornada": "border-coral/40 bg-[#fff0ed] text-coral"
  };

  return (
    <span className={`inline-flex w-fit items-center rounded-md border px-2 py-1 text-xs font-semibold ${classNameByLabel[label]}`}>
      {label}
    </span>
  );
}
