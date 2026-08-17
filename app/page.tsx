"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, RefreshCw, Wand2 } from "lucide-react";
import { getISODay } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button, Field, GhostButton, Input, Notice, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { ALL_DEPARTMENTS, departmentSlug, findDepartmentByParam } from "@/lib/departments";
import { formatDateEs, monthDays, monthLabel, monthRange } from "@/lib/dates";
import { assignmentHours, operationalMonthlyTarget } from "@/lib/hours";
import type { Department, DepartmentShiftCoverageRule, Employee, EmployeeWorkloadPeriod, ShiftAssignment, ShiftSwap, ShiftType } from "@/lib/database.types";
import { generateShiftsFromPatterns } from "@/lib/pattern-generation";
import { DEFAULT_RESIDENCE_NAME, exportScheduleExcel, exportSchedulePdf, type ScheduleExportSnapshot } from "@/lib/schedule-export";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

const NON_COVERAGE_SHIFT_CODES = new Set(["L", "V", "VAC", "VACACIONES", "LIBRE"]);

type SelectedCell = {
  employeeId: string;
  date: string;
};

type SwapDetail = {
  swap: ShiftSwap;
  otherEmployeeId: string;
  otherDate: string;
  originalShiftId: string;
  newShiftId: string;
  previousSource: ShiftAssignment["source"];
  previousSourceId: string | null;
};

function isDefaultCoverageShiftType(shiftType: ShiftType) {
  return Number(shiftType.computable_hours) > 0 && !NON_COVERAGE_SHIFT_CODES.has(shiftType.code.trim().toUpperCase());
}

function isMissingCoverageRulesTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("department_shift_coverage_rules")
  );
}

function isMissingShiftSwapsTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("shift_swaps")
  );
}

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
  const [monthSwaps, setMonthSwaps] = useState<ShiftSwap[]>([]);
  const [coverageRules, setCoverageRules] = useState<DepartmentShiftCoverageRule[]>([]);
  const [selectedCoverageShiftTypeIds, setSelectedCoverageShiftTypeIds] = useState<string[] | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [showSwapForm, setShowSwapForm] = useState(false);
  const [swapSaving, setSwapSaving] = useState(false);
  const [swapForm, setSwapForm] = useState({
    employee_b_id: "",
    employee_b_date: "",
    reason: ""
  });
  const [zoom, setZoom] = useState(1);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [generateForm, setGenerateForm] = useState({
    start_date: "",
    end_date: "",
    allEmployees: true,
    employeeIds: [] as string[],
    overwriteExisting: false
  });
  const { toast } = useToast();

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

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const shiftTypeById = useMemo(() => new Map(shiftTypes.map((type) => [type.id, type])), [shiftTypes]);

  const swapById = useMemo(() => new Map(monthSwaps.map((swap) => [swap.id, swap])), [monthSwaps]);

  const selectedAssignment = selectedCell ? assignmentByCell.get(`${selectedCell.employeeId}-${selectedCell.date}`) ?? null : null;
  const selectedEmployee = selectedCell ? employeeById.get(selectedCell.employeeId) ?? null : null;
  const selectedShiftType = selectedAssignment ? shiftTypeById.get(selectedAssignment.shift_type_id) ?? null : null;
  const secondAssignment = swapForm.employee_b_id && swapForm.employee_b_date
    ? assignmentByCell.get(`${swapForm.employee_b_id}-${swapForm.employee_b_date}`) ?? null
    : null;
  const secondEmployee = swapForm.employee_b_id ? employeeById.get(swapForm.employee_b_id) ?? null : null;
  const secondShiftType = secondAssignment ? shiftTypeById.get(secondAssignment.shift_type_id) ?? null : null;

  const coverageShiftTypes = useMemo(() => {
    const available = selectedDepartmentId === ALL_DEPARTMENTS
      ? shiftTypes
      : shiftTypes.filter((type) => !type.department_id || type.department_id === selectedDepartmentId);
    return [...available].sort((first, second) => first.code.localeCompare(second.code));
  }, [selectedDepartmentId, shiftTypes]);

  const defaultCoverageShiftTypeIds = useMemo(() => {
    return coverageShiftTypes.filter(isDefaultCoverageShiftType).map((type) => type.id);
  }, [coverageShiftTypes]);

  const activeCoverageShiftTypeIds = selectedCoverageShiftTypeIds ?? defaultCoverageShiftTypeIds;

  const visibleCoverageShiftTypes = useMemo(() => {
    const activeIds = new Set(activeCoverageShiftTypeIds);
    return coverageShiftTypes.filter((type) => activeIds.has(type.id));
  }, [activeCoverageShiftTypeIds, coverageShiftTypes]);

  const visibleEmployeeIds = useMemo(() => new Set(visibleEmployees.map((employee) => employee.id)), [visibleEmployees]);

  const coverageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of monthAssignments) {
      if (!visibleEmployeeIds.has(assignment.employee_id)) continue;
      const key = `${assignment.shift_type_id}-${assignment.date}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [monthAssignments, visibleEmployeeIds]);

  const coverageRuleByShiftAndDay = useMemo(() => {
    const exactRules = new Map<string, DepartmentShiftCoverageRule>();
    const defaultRules = new Map<string, DepartmentShiftCoverageRule>();
    for (const rule of coverageRules) {
      if (rule.day_of_week === null) {
        defaultRules.set(rule.shift_type_id, rule);
      } else {
        exactRules.set(`${rule.shift_type_id}-${rule.day_of_week}`, rule);
      }
    }
    return { exactRules, defaultRules };
  }, [coverageRules]);

  const loadData = useCallback(async () => {
    if (!supabase) return;
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
    const { data: swapData, error: swapError } = await supabase
      .from("shift_swaps")
      .select("*")
      .or(`and(employee_a_original_date.gte.${range.startIso},employee_a_original_date.lte.${range.endIso}),and(employee_b_original_date.gte.${range.startIso},employee_b_original_date.lte.${range.endIso})`)
      .order("created_at", { ascending: false });
    const { data: coverageRuleData, error: coverageRuleError } = selectedDepartmentId === ALL_DEPARTMENTS
      ? { data: [], error: null }
      : await supabase
        .from("department_shift_coverage_rules")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .eq("is_active", true);

    const error = employeeError ?? workloadError ?? typeError ?? departmentError ?? monthError ?? (isMissingShiftSwapsTable(swapError) ? null : swapError) ?? (isMissingCoverageRulesTable(coverageRuleError) ? null : coverageRuleError);
    if (error) toast({ type: "error", title: "No se pudo cargar la planilla", description: error.message });
    setEmployees(employeeData ?? []);
    const nextDepartments = departmentData ?? [];
    setDepartments(nextDepartments);
    const requestedDepartment = findDepartmentByParam(nextDepartments, searchParams.get("department"));
    setSelectedDepartmentId((current) => current === ALL_DEPARTMENTS && requestedDepartment ? requestedDepartment.id : current);
    setWorkloadPeriods(workloadData ?? []);
    setShiftTypes(typeData ?? []);
    setMonthAssignments(monthData ?? []);
    setMonthSwaps((swapData as ShiftSwap[] | null) ?? []);
    setCoverageRules((coverageRuleData as DepartmentShiftCoverageRule[] | null) ?? []);
  }, [range.endIso, range.startIso, searchParams, selectedDepartmentId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setGenerateForm((current) => ({
      ...current,
      start_date: range.startIso,
      end_date: range.endIso
    }));
    setSwapForm((current) => ({
      ...current,
      employee_b_date: current.employee_b_date || range.startIso
    }));
  }, [range.endIso, range.startIso]);

  function moveMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  function changeDepartment(departmentId: string) {
    setSelectedDepartmentId(departmentId);
    setSelectedCoverageShiftTypeIds(null);
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

  function selectCell(employeeId: string, date: string) {
    setSelectedCell({ employeeId, date });
    setShowSwapForm(false);
    setSwapForm((current) => ({
      ...current,
      employee_b_id: current.employee_b_id || visibleEmployees.find((employee) => employee.id !== employeeId)?.id || employeeId,
      employee_b_date: current.employee_b_date || date
    }));
  }

  function startSwapFromSelectedCell() {
    if (!selectedCell || !selectedAssignment) {
      toast({ type: "warning", title: "Selecciona un turno", description: "Selecciona una celda con turno asignado para registrar un cambio." });
      return;
    }
    setShowSwapForm(true);
    setSwapForm((current) => ({
      ...current,
      employee_b_id: current.employee_b_id || visibleEmployees.find((employee) => employee.id !== selectedCell.employeeId)?.id || selectedCell.employeeId,
      employee_b_date: current.employee_b_date || selectedCell.date
    }));
  }

  function swapDetailFor(assignment: ShiftAssignment | undefined): SwapDetail | null {
    if (!assignment || assignment.source !== "swap" || !assignment.source_id) return null;
    const swap = swapById.get(assignment.source_id);
    if (!swap) return null;
    const isEmployeeA = swap.employee_a_id === assignment.employee_id && swap.employee_a_original_date === assignment.date;
    const isEmployeeB = swap.employee_b_id === assignment.employee_id && swap.employee_b_original_date === assignment.date;
    if (!isEmployeeA && !isEmployeeB) return null;
    return {
      swap,
      otherEmployeeId: isEmployeeA ? swap.employee_b_id : swap.employee_a_id,
      otherDate: isEmployeeA ? swap.employee_b_original_date : swap.employee_a_original_date,
      originalShiftId: isEmployeeA ? swap.employee_a_original_shift_id : swap.employee_b_original_shift_id,
      newShiftId: isEmployeeA ? swap.employee_a_new_shift_id : swap.employee_b_new_shift_id,
      previousSource: isEmployeeA ? swap.employee_a_previous_source : swap.employee_b_previous_source,
      previousSourceId: isEmployeeA ? swap.employee_a_previous_source_id : swap.employee_b_previous_source_id
    };
  }

  function shortUserId(userId: string | null) {
    return userId ? `${userId.slice(0, 8)}...` : "-";
  }

  async function registerSwap() {
    if (!supabase || !selectedCell) return;

    if (!selectedAssignment) {
      toast({ type: "warning", title: "Cambio no disponible", description: "La primera celda seleccionada no tiene un turno asignado." });
      return;
    }
    if (!swapForm.employee_b_id || !swapForm.employee_b_date) {
      toast({ type: "warning", title: "Seleccion incompleta", description: "Selecciona el segundo empleado y la fecha del segundo turno." });
      return;
    }
    if (selectedCell.employeeId === swapForm.employee_b_id && selectedCell.date === swapForm.employee_b_date) {
      toast({ type: "warning", title: "Cambio no valido", description: "No se puede registrar un cambio de turno contra la misma celda." });
      return;
    }
    if (!secondAssignment) {
      toast({ type: "warning", title: "Cambio no disponible", description: "La segunda celda seleccionada no tiene un turno asignado." });
      return;
    }

    setSwapSaving(true);
    const { error } = await supabase.rpc("register_approved_shift_swap", {
      p_employee_a_id: selectedCell.employeeId,
      p_employee_a_date: selectedCell.date,
      p_employee_b_id: swapForm.employee_b_id,
      p_employee_b_date: swapForm.employee_b_date,
      p_reason: swapForm.reason.trim() || null
    });

    if (error) {
      toast({ type: "error", title: "No se pudo registrar el cambio", description: error.message });
      setSwapSaving(false);
      return;
    }

    toast({ type: "success", title: "Cambio de turno registrado" });
    setShowSwapForm(false);
    setSwapForm((current) => ({ ...current, reason: "" }));
    await loadData();
    setSwapSaving(false);
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
          source_id: null,
          employee_shift_pattern_id: null,
          generated_at: null,
          updated_by_user_id: null
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
    try {
      const result = await generateShiftsFromPatterns(supabase, {
        startDate: generateForm.start_date,
        endDate: generateForm.end_date,
        employeeIds: generateForm.allEmployees ? visibleEmployees.map((employee) => employee.id) : generateForm.employeeIds,
        overwriteExisting: generateForm.overwriteExisting
      });
      if (result.generated > 0 && result.skippedExisting > 0) {
        toast({
          type: "warning",
          title: "Patrones aplicados",
          description: `Se generaron ${result.generated} turnos y se omitieron ${result.skippedExisting} porque ya tenian turno.`
        });
      } else if (result.generated > 0) {
        toast({ type: "success", title: "Patrones aplicados correctamente", description: `Se han generado ${result.generated} turnos.` });
      } else if (result.skippedExisting > 0) {
        toast({ type: "warning", title: "No se generaron turnos", description: `${result.skippedExisting} dias ya tenian turno asignado.` });
      } else if (result.skippedEmptyPatterns > 0) {
        toast({ type: "warning", title: "No se generaron turnos", description: "Los patrones encontrados no tienen dias disponibles." });
      } else if (result.skippedInactiveEmployees > 0) {
        toast({ type: "warning", title: "No se generaron turnos", description: "Los empleados encontrados no estan activos en el rango seleccionado." });
      } else {
        toast({ type: "warning", title: "No se generaron turnos", description: "Revisa que existan patrones activos para los empleados y que el rango de fechas contenga dias aplicables." });
      }
      await loadData();
    } catch (error) {
      toast({
        type: "error",
        title: "No se pudo aplicar el patron",
        description: error instanceof Error ? error.message : "Error desconocido"
      });
    } finally {
      setGenerating(false);
    }
  }

  function toggleCoverageShiftType(shiftTypeId: string) {
    setSelectedCoverageShiftTypeIds((current) => {
      const activeIds = new Set(current ?? defaultCoverageShiftTypeIds);
      if (activeIds.has(shiftTypeId)) {
        activeIds.delete(shiftTypeId);
      } else {
        activeIds.add(shiftTypeId);
      }
      return Array.from(activeIds);
    });
  }

  function coverageRuleFor(shiftTypeId: string, date: Date) {
    const dayOfWeek = getISODay(date);
    return (
      coverageRuleByShiftAndDay.exactRules.get(`${shiftTypeId}-${dayOfWeek}`) ??
      coverageRuleByShiftAndDay.defaultRules.get(shiftTypeId) ??
      null
    );
  }

  function coverageStatusClass(count: number, rule: DepartmentShiftCoverageRule | null) {
    if (!rule) return "text-ink";
    if (count < rule.min_required) return "bg-[#fff0ed] text-coral";
    if (rule.max_allowed !== null && count > rule.max_allowed) return "bg-[#fff7dc] text-[#9a6500]";
    return "text-ink";
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

  function exportSnapshot(): ScheduleExportSnapshot {
    return {
      residenceName: DEFAULT_RESIDENCE_NAME,
      department: selectedDepartment?.name ?? "Todos los departamentos",
      period: monthLabel(year, month),
      generatedAt: new Date(),
      days: days.map((day) => ({ iso: day.iso, day: day.day, weekday: day.weekday })),
      employees: visibleEmployees.map((employee) => {
        const summary = employeeSummary(employee);
        return {
          name: employee.name,
          department: departments.find((department) => department.id === employee.department_id)?.name ?? "Sin departamento",
          monthHours: summary.monthHours,
          monthTarget: summary.monthTarget,
          shifts: Object.fromEntries(days.map((day) => {
            const assignment = assignmentByCell.get(`${employee.id}-${day.iso}`);
            const shiftType = assignment ? shiftTypeById.get(assignment.shift_type_id) : undefined;
            return [day.iso, shiftType ? { code: shiftType.code, color: shiftType.color } : undefined];
          }))
        };
      }),
      dailySummary: coverageShiftTypes.map((type) => ({
        code: type.code,
        name: type.name,
        color: type.color,
        counts: Object.fromEntries(days.map((day) => [day.iso, coverageCounts.get(`${type.id}-${day.iso}`) ?? 0]))
      }))
    };
  }

  async function runExport(format: "pdf" | "excel") {
    setExporting(format);
    try {
      const snapshot = exportSnapshot();
      if (format === "pdf") {
        await exportSchedulePdf(snapshot);
      } else {
        await exportScheduleExcel(snapshot);
      }
    } catch (error) {
      toast({ type: "error", title: "No se pudo generar la exportacion", description: error instanceof Error ? error.message : "Error desconocido" });
    } finally {
      setExporting(null);
    }
  }

  const selectedSwapDetail = swapDetailFor(selectedAssignment ?? undefined);
  const visibleSwapRows = monthSwaps.filter((swap) => {
    if (selectedDepartmentId === ALL_DEPARTMENTS) return true;
    const employeeA = employeeById.get(swap.employee_a_id);
    const employeeB = employeeById.get(swap.employee_b_id);
    return employeeA?.department_id === selectedDepartmentId || employeeB?.department_id === selectedDepartmentId;
  });

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
          <GhostButton type="button" disabled={exporting !== null || visibleEmployees.length === 0} onClick={() => runExport("pdf")} className="min-h-9 px-3">
            <FileDown className="h-4 w-4" />{exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
          </GhostButton>
          <GhostButton type="button" disabled={exporting !== null || visibleEmployees.length === 0} onClick={() => runExport("excel")} className="min-h-9 px-3">
            <FileSpreadsheet className="h-4 w-4" />{exporting === "excel" ? "Exportando..." : "Exportar Excel"}
          </GhostButton>
          <GhostButton type="button" onClick={loadData} className="min-h-9 px-3"><RefreshCw className="h-4 w-4" />Actualizar</GhostButton>
        </>
      }
    >
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para cargar y guardar la planilla.</Notice> : null}
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
              {generating ? "Aplicando patron..." : "Generar"}
            </Button>
          </div>
        </div>
      ) : null}
      {selectedCell ? (
        <div className="mb-3 rounded-md border border-line bg-white p-3 shadow-subtle">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-moss">Celda seleccionada</div>
              <div className="mt-1 font-semibold">
                {selectedEmployee?.name ?? "Empleado"} · {formatDateEs(selectedCell.date)} · {selectedShiftType?.code ?? "Sin turno"}
              </div>
              {selectedSwapDetail ? (
                <div className="mt-2 grid gap-1 text-sm text-moss">
                  <div>Cambio con {employeeById.get(selectedSwapDetail.otherEmployeeId)?.name ?? "otro empleado"} el {formatDateEs(selectedSwapDetail.otherDate)}.</div>
                  <div>
                    Turno original {shiftTypeById.get(selectedSwapDetail.originalShiftId)?.code ?? "-"}; turno actual {shiftTypeById.get(selectedSwapDetail.newShiftId)?.code ?? "-"}.
                  </div>
                  <div>Origen anterior: {selectedSwapDetail.previousSource}{selectedSwapDetail.previousSourceId ? ` (${selectedSwapDetail.previousSourceId.slice(0, 8)}...)` : ""}.</div>
                  <div>Motivo: {selectedSwapDetail.swap.reason ?? "-"}</div>
                  <div>Registrado por: {shortUserId(selectedSwapDetail.swap.approved_by_user_id)} · {formatDateEs(selectedSwapDetail.swap.approved_at)}</div>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-9 px-3" disabled={!selectedAssignment} onClick={startSwapFromSelectedCell}>
                <ArrowLeftRight className="h-4 w-4" />
                Registrar cambio
              </Button>
              <GhostButton type="button" className="min-h-9 px-3" onClick={() => setSelectedCell(null)}>Cerrar</GhostButton>
            </div>
          </div>
          {showSwapForm ? (
            <div className="mt-4 border-t border-line pt-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_minmax(260px,1fr)_auto] lg:items-end">
                <Field label="Segundo empleado">
                  <Select value={swapForm.employee_b_id} onChange={(event) => setSwapForm({ ...swapForm, employee_b_id: event.target.value })}>
                    {visibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                  </Select>
                </Field>
                <Field label="Fecha segundo turno">
                  <Input type="date" min={range.startIso} max={range.endIso} value={swapForm.employee_b_date} onChange={(event) => setSwapForm({ ...swapForm, employee_b_date: event.target.value })} />
                </Field>
                <Field label="Motivo">
                  <Textarea value={swapForm.reason} onChange={(event) => setSwapForm({ ...swapForm, reason: event.target.value })} />
                </Field>
                <Button type="button" disabled={swapSaving || !selectedAssignment || !secondAssignment} onClick={registerSwap}>
                  <ArrowLeftRight className="h-4 w-4" />
                  Confirmar
                </Button>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-md border border-line bg-paper p-3">
                  <div className="mb-2 font-semibold">Antes</div>
                  <div>{selectedEmployee?.name ?? "-"} {formatDateEs(selectedCell.date)} {selectedShiftType?.code ?? "Sin turno"}</div>
                  <div>{secondEmployee?.name ?? "-"} {formatDateEs(swapForm.employee_b_date)} {secondShiftType?.code ?? (swapForm.employee_b_date ? "Sin turno" : "-")}</div>
                </div>
                <div className="rounded-md border border-line bg-paper p-3">
                  <div className="mb-2 font-semibold">Después</div>
                  <div>{selectedEmployee?.name ?? "-"} {formatDateEs(selectedCell.date)} {secondShiftType?.code ?? "-"}</div>
                  <div>{secondEmployee?.name ?? "-"} {formatDateEs(swapForm.employee_b_date)} {selectedShiftType?.code ?? "-"}</div>
                </div>
              </div>
              {!secondAssignment && swapForm.employee_b_id && swapForm.employee_b_date ? (
                <div className="mt-3 rounded-md border border-saffron/40 bg-[#fff7df] px-3 py-2 text-sm">
                  La segunda celda no tiene turno asignado. Elige una celda con turno para poder intercambiar.
                </div>
              ) : null}
            </div>
          ) : null}
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
                    const shiftType = assignment ? shiftTypeById.get(assignment.shift_type_id) : undefined;
                    const isSelected = selectedCell?.employeeId === employee.id && selectedCell.date === day.iso;
                    const isSwapAssignment = assignment?.source === "swap";
                    const swapDetail = swapDetailFor(assignment);
                    return (
                      <td
                        key={day.iso}
                        className={`schedule-day-cell relative border-r p-0 ${isSelected ? "border-2 border-ink" : isSwapAssignment ? "border-2 border-moss" : "border-line"}`}
                        style={{ backgroundColor: shiftType?.color ?? "white" }}
                        title={isSwapAssignment ? "Cambio de turno registrado" : undefined}
                        onClick={() => selectCell(employee.id, day.iso)}
                      >
                        <select
                          aria-label={`${employee.name} ${day.iso}`}
                          className={`h-full w-full appearance-none bg-transparent pl-0.5 text-center text-xs font-bold outline-none ${isSwapAssignment ? "pr-3" : "pr-0.5"}`}
                          value={assignment?.shift_type_id ?? ""}
                          disabled={savingCell === key}
                          onChange={(event) => saveAssignment(employee.id, day.iso, event.target.value)}
                        >
                          <option value=""></option>
                          {shiftTypeOptionsFor(employee, assignment?.shift_type_id).map((type) => (
                            <option key={type.id} value={type.id}>{type.code}</option>
                          ))}
                        </select>
                        {isSwapAssignment ? (
                          <span
                            className="pointer-events-none absolute right-0.5 top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-white/85 text-[10px] font-bold text-ink"
                            title={swapDetail ? `Cambio con ${employeeById.get(swapDetail.otherEmployeeId)?.name ?? "otro empleado"}` : "Cambio de turno registrado"}
                          >
                            ↔
                          </span>
                        ) : null}
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
        <div className="border-t border-line bg-white">
          <div className="sticky left-0 z-10 border-b border-line bg-white px-3 py-3">
            <div className="mb-2 text-sm font-semibold">Resumen diario por turno</div>
            <div className="flex flex-wrap gap-2">
              {coverageShiftTypes.map((type) => {
                const checked = activeCoverageShiftTypeIds.includes(type.id);
                return (
                  <label key={type.id} className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-semibold ${checked ? "border-ink bg-paper text-ink" : "border-line bg-white text-moss"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCoverageShiftType(type.id)}
                    />
                    <span className="inline-flex rounded px-1.5 py-0.5" style={{ backgroundColor: type.color }}>{type.code}</span>
                  </label>
                );
              })}
              <button type="button" className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-moss hover:bg-paper hover:text-ink" onClick={() => setSelectedCoverageShiftTypeIds(null)}>
                Cobertura por defecto
              </button>
            </div>
          </div>
          <table className="schedule-table schedule-coverage-table w-full border-collapse text-sm" style={scheduleTableStyle}>
            <colgroup>
              <col className="schedule-employee-col" />
              {days.map((day) => <col key={day.iso} className="schedule-day-col" />)}
              <col className="schedule-summary-col schedule-total-col" />
              <col className="schedule-summary-col schedule-diff-col" />
            </colgroup>
            <tbody>
              {visibleCoverageShiftTypes.map((type) => (
                <tr key={type.id} className="border-b border-line last:border-0">
                  <th className="schedule-coverage-label sticky left-0 z-10 border-r border-line bg-paper px-2 text-left font-semibold">
                    <span className="inline-flex rounded px-1.5 py-0.5" style={{ backgroundColor: type.color }}>{type.code}</span>
                    <span className="ml-2 text-xs font-normal text-moss">{type.name}</span>
                  </th>
                  {days.map((day) => {
                    const count = coverageCounts.get(`${type.id}-${day.iso}`) ?? 0;
                    const rule = selectedDepartmentId === ALL_DEPARTMENTS ? null : coverageRuleFor(type.id, day.date);
                    return (
                      <td key={day.iso} className={`schedule-coverage-cell border-r border-line px-0.5 text-center font-semibold ${coverageStatusClass(count, rule)}`}>
                        {count}
                      </td>
                    );
                  })}
                  <td className="schedule-summary-cell schedule-summary-col border-r border-line px-3 text-right text-moss"></td>
                  <td className="schedule-summary-cell schedule-summary-col px-3 text-right text-moss"></td>
                </tr>
              ))}
              {visibleCoverageShiftTypes.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-sm text-moss" colSpan={days.length + 3}>Selecciona al menos un tipo de turno para ver el resumen.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <section className="mt-5 overflow-auto rounded-md border border-line bg-white shadow-subtle">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-semibold">Cambios de turno</h3>
        </div>
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
            <tr>
              <th className="border-b border-line px-3 py-3">Fecha registro</th>
              <th className="border-b border-line px-3 py-3">Trabajador A</th>
              <th className="border-b border-line px-3 py-3">Trabajador B</th>
              <th className="border-b border-line px-3 py-3">Turnos intercambiados</th>
              <th className="border-b border-line px-3 py-3">Estado</th>
              <th className="border-b border-line px-3 py-3">Registrado por</th>
            </tr>
          </thead>
          <tbody>
            {visibleSwapRows.map((swap) => (
              <tr key={swap.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">{formatDateEs(swap.created_at)}</td>
                <td className="px-3 py-3 font-medium">{employeeById.get(swap.employee_a_id)?.name ?? "-"}</td>
                <td className="px-3 py-3 font-medium">{employeeById.get(swap.employee_b_id)?.name ?? "-"}</td>
                <td className="px-3 py-3">
                  {formatDateEs(swap.employee_a_original_date)} {shiftTypeById.get(swap.employee_a_original_shift_id)?.code ?? "-"} ↔ {formatDateEs(swap.employee_b_original_date)} {shiftTypeById.get(swap.employee_b_original_shift_id)?.code ?? "-"}
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-md border border-line bg-paper px-2 py-1 text-xs font-semibold uppercase">{swap.status}</span>
                </td>
                <td className="px-3 py-3">{shortUserId(swap.approved_by_user_id ?? swap.requested_by_user_id)}</td>
              </tr>
            ))}
            {visibleSwapRows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-sm text-moss" colSpan={6}>No hay cambios de turno registrados en este mes.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
