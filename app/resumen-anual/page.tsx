"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Notice, Select } from "@/components/ui";
import {
  annualTargetByPeriods,
  assignmentHours,
  currentWorkloadPercentage,
  proportionalTargetByPeriodsUntilDate
} from "@/lib/hours";
import type { Employee, EmployeeWorkloadPeriod, ShiftAssignment, ShiftType } from "@/lib/database.types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AnnualSummaryPage() {
  const [today] = useState(() => new Date());
  const currentYear = today.getFullYear();
  const todayIso = localIsoDate(today);
  const [year, setYear] = useState(currentYear);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workloadPeriods, setWorkloadPeriods] = useState<EmployeeWorkloadPeriod[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase) return;
    const { data: employeeData, error: employeeError } = await supabase.from("employees").select("*").order("name");
    const { data: workloadData, error: workloadError } = await supabase
      .from("employee_workload_periods")
      .select("*")
      .lte("start_date", `${year}-12-31`)
      .or(`end_date.is.null,end_date.gte.${year}-01-01`)
      .order("start_date");
    const { data: typeData, error: typeError } = await supabase.from("shift_types").select("*").order("code");
    const { data: assignmentData, error: assignmentError } = await supabase
      .from("shift_assignments")
      .select("*")
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`);
    const error = employeeError ?? workloadError ?? typeError ?? assignmentError;
    if (error) setMessage(error.message);
    setEmployees(employeeData ?? []);
    setWorkloadPeriods(workloadData ?? []);
    setShiftTypes(typeData ?? []);
    setAssignments(assignmentData ?? []);
  }, [year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    return employees.map((employee) => {
      const employeeAssignments = assignments.filter((assignment) => assignment.employee_id === employee.id);
      const employeePeriods = workloadPeriods.filter((period) => period.employee_id === employee.id);
      const hours = assignmentHours(employeeAssignments, shiftTypes);
      const targetResult = annualTargetByPeriods(employee, employeePeriods, year);
      const currentWorkload = currentWorkloadPercentage(employeePeriods, today);
      return { employee, hours, target: targetResult.target, diff: hours - targetResult.target, currentWorkload, missingRanges: targetResult.missingRanges };
    });
  }, [employees, assignments, shiftTypes, workloadPeriods, today, year]);

  const trackingRows = useMemo(() => {
    return employees.map((employee) => {
      const employeeAssignments = assignments.filter((assignment) => assignment.employee_id === employee.id && assignment.date <= todayIso);
      const employeePeriods = workloadPeriods.filter((period) => period.employee_id === employee.id);
      const hours = assignmentHours(employeeAssignments, shiftTypes);
      const targetResult = proportionalTargetByPeriodsUntilDate(employee, employeePeriods, year, today);
      const currentWorkload = currentWorkloadPercentage(employeePeriods, today);
      return { employee, hours, target: targetResult.target, diff: hours - targetResult.target, currentWorkload, missingRanges: targetResult.missingRanges };
    });
  }, [employees, assignments, shiftTypes, workloadPeriods, today, todayIso, year]);

  return (
    <PageShell
      title="Resumen anual"
      subtitle="Horas planificadas del año completo frente al objetivo anual."
      actions={
        <Select value={year} onChange={(event) => setYear(Number(event.target.value))} className="w-32">
          {Array.from({ length: 7 }, (_, index) => currentYear - 3 + index).map((optionYear) => (
            <option key={optionYear} value={optionYear}>{optionYear}</option>
          ))}
        </Select>
      }
    >
      {!isSupabaseConfigured ? <Notice>Configura las variables de Supabase para activar esta pantalla.</Notice> : null}
      {message ? <div className="mb-4 rounded-md border border-coral/40 bg-[#fff0ed] px-4 py-3 text-sm">{message}</div> : null}
      <section className="mb-6">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Resumen anual</h3>
          <p className="mt-1 text-sm text-moss">Año completo seleccionado.</p>
        </div>
        <div className="overflow-auto rounded-md border border-line bg-white shadow-subtle">
          <table className="min-w-[820px] w-full border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
              <tr>
                <th className="border-b border-line px-3 py-3">Empleado</th>
                <th className="border-b border-line px-3 py-3">Categoría</th>
                <th className="border-b border-line px-3 py-3 text-right">Jornada</th>
                <th className="border-b border-line px-3 py-3 text-right">Horas planificadas</th>
                <th className="border-b border-line px-3 py-3 text-right">Objetivo anual</th>
                <th className="border-b border-line px-3 py-3 text-right">Diferencia anual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ employee, hours, target, diff, currentWorkload, missingRanges }) => (
                <tr key={employee.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-medium">{employee.name}</td>
                  <td className="px-3 py-3">{employee.category}</td>
                  <td className="px-3 py-3 text-right">
                    {currentWorkload ? `${currentWorkload}%` : "Sin jornada"}
                    {missingRanges.length > 0 ? <div className="text-xs text-coral">Sin jornada definida para este periodo</div> : null}
                  </td>
                  <td className="px-3 py-3 text-right">{hours.toFixed(1)} h</td>
                  <td className="px-3 py-3 text-right">{target.toFixed(1)} h</td>
                  <td className={`px-3 py-3 text-right font-semibold ${diff >= 0 ? "text-moss" : "text-coral"}`}>
                    {diff >= 0 ? "+" : ""}{diff.toFixed(1)} h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Seguimiento anual</h3>
          <p className="mt-1 text-sm text-moss">Acumulado hasta hoy frente al objetivo proporcional.</p>
        </div>
        <div className="overflow-auto rounded-md border border-line bg-white shadow-subtle">
          <table className="min-w-[820px] w-full border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-moss">
              <tr>
                <th className="border-b border-line px-3 py-3">Empleado</th>
                <th className="border-b border-line px-3 py-3">Categoría</th>
                <th className="border-b border-line px-3 py-3 text-right">Jornada</th>
                <th className="border-b border-line px-3 py-3 text-right">Horas acumuladas</th>
                <th className="border-b border-line px-3 py-3 text-right">Objetivo proporcional</th>
                <th className="border-b border-line px-3 py-3 text-right">Diferencia actual</th>
              </tr>
            </thead>
            <tbody>
              {trackingRows.map(({ employee, hours, target, diff, currentWorkload, missingRanges }) => (
                <tr key={employee.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-medium">{employee.name}</td>
                  <td className="px-3 py-3">{employee.category}</td>
                  <td className="px-3 py-3 text-right">
                    {currentWorkload ? `${currentWorkload}%` : "Sin jornada"}
                    {missingRanges.length > 0 ? <div className="text-xs text-coral">Sin jornada definida para este periodo</div> : null}
                  </td>
                  <td className="px-3 py-3 text-right">{hours.toFixed(1)} h</td>
                  <td className="px-3 py-3 text-right">{target.toFixed(1)} h</td>
                  <td className={`px-3 py-3 text-right font-semibold ${diff >= 0 ? "text-moss" : "text-coral"}`}>
                    {diff >= 0 ? "+" : ""}{diff.toFixed(1)} h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
