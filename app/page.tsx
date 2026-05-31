"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GhostButton, Notice, Select } from "@/components/ui";
import { monthDays, monthLabel, monthRange } from "@/lib/dates";
import { assignmentHours, monthlyTarget, proportionalTarget } from "@/lib/hours";
import type { Employee, ShiftAssignment, ShiftType } from "@/lib/database.types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function SchedulePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [monthAssignments, setMonthAssignments] = useState<ShiftAssignment[]>([]);
  const [yearAssignments, setYearAssignments] = useState<ShiftAssignment[]>([]);
  const [message, setMessage] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const days = useMemo(() => monthDays(year, month), [year, month]);
  const range = useMemo(() => monthRange(year, month), [year, month]);

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
    const { data: typeData, error: typeError } = await supabase.from("shift_types").select("*").order("code");
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

    const error = employeeError ?? typeError ?? monthError ?? yearError;
    if (error) setMessage(error.message);
    setEmployees(employeeData ?? []);
    setShiftTypes(typeData ?? []);
    setMonthAssignments(monthData ?? []);
    setYearAssignments(yearData ?? []);
  }, [range.endIso, range.startIso, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function moveMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
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
        { employee_id: employeeId, date, shift_type_id: shiftTypeId },
        { onConflict: "employee_id,date" }
      );
    }
    await loadData();
    setSavingCell(null);
  }

  function employeeSummary(employee: Employee) {
    const monthRows = monthAssignments.filter((assignment) => assignment.employee_id === employee.id);
    const yearRows = yearAssignments.filter((assignment) => assignment.employee_id === employee.id);
    const monthHours = assignmentHours(monthRows, shiftTypes);
    const yearHours = assignmentHours(yearRows, shiftTypes);
    const target = proportionalTarget(employee, month);
    return {
      monthHours,
      yearHours,
      monthTarget: monthlyTarget(employee),
      target,
      diff: yearHours - target
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
          <GhostButton type="button" onClick={loadData}><RefreshCw className="h-4 w-4" /></GhostButton>
        </>
      }
    >
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para cargar y guardar la planilla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
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
            {employees.map((employee) => {
              const summary = employeeSummary(employee);
              return (
                <tr key={employee.id} className="border-b border-line last:border-0">
                  <th className="sticky left-0 z-10 border-r border-line bg-white px-3 py-2 text-left font-semibold">
                    <span className="block">{employee.name}</span>
                    <span className="text-xs font-normal text-moss">{employee.category}</span>
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
                          {shiftTypes.map((type) => (
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {employees.length === 0 ? <div className="px-4 py-8 text-center text-sm text-moss">No hay empleados activos para este mes.</div> : null}
      </div>
    </PageShell>
  );
}
