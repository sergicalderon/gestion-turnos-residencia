import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Employee, EmployeeWorkloadPeriod, ShiftAssignment, ShiftType } from "@/lib/database.types";

export function assignmentHours(assignments: ShiftAssignment[], shiftTypes: ShiftType[]) {
  const byId = new Map(shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
  return assignments.reduce((total, assignment) => {
    return total + Number(byId.get(assignment.shift_type_id)?.computable_hours ?? 0);
  }, 0);
}

export function annualTarget(employee: Employee) {
  const annualTargetHours = Number(employee.annual_target_hours);
  const percentage = Number(employee.workday_percentage) / 100;
  return annualTargetHours * percentage;
}

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function yearBounds(year: number) {
  return {
    startIso: `${year}-01-01`,
    endIso: `${year}-12-31`
  };
}

function daysBetweenInclusive(startIso: string, endIso: string) {
  return differenceInCalendarDays(parseISO(endIso), parseISO(startIso)) + 1;
}

function maxIso(...dates: string[]) {
  return dates.reduce((max, date) => (date > max ? date : max));
}

function minIso(...dates: string[]) {
  return dates.reduce((min, date) => (date < min ? date : min));
}

export type WorkloadTargetResult = {
  target: number;
  missingRanges: { start: string; end: string }[];
  effectiveStart: string;
  effectiveEnd: string;
};

export function currentWorkloadPercentage(periods: EmployeeWorkloadPeriod[], today = new Date()) {
  const todayIso = format(dateOnly(today), "yyyy-MM-dd");
  const sortedPeriods = [...periods].sort((first, second) => second.start_date.localeCompare(first.start_date));
  const current = sortedPeriods.find((period) => period.start_date <= todayIso && (!period.end_date || period.end_date >= todayIso));
  return current?.workload_percentage ?? sortedPeriods[0]?.workload_percentage ?? null;
}

export function workloadTargetForRange(
  employee: Employee,
  periods: EmployeeWorkloadPeriod[],
  year: number,
  rangeEndIso = `${year}-12-31`
): WorkloadTargetResult {
  return workloadTargetForExactRange(employee, periods, year, `${year}-01-01`, rangeEndIso);
}

export function workloadTargetForExactRange(
  employee: Employee,
  periods: EmployeeWorkloadPeriod[],
  year: number,
  rangeStartIso: string,
  rangeEndIso: string
): WorkloadTargetResult {
  const { startIso: yearStartIso, endIso: yearEndIso } = yearBounds(year);
  const effectiveStart = maxIso(yearStartIso, rangeStartIso, employee.start_date);
  const effectiveEnd = minIso(yearEndIso, rangeEndIso, employee.end_date ?? yearEndIso);

  if (effectiveStart > effectiveEnd) {
    return { target: 0, missingRanges: [], effectiveStart, effectiveEnd };
  }

  const yearDays = daysBetweenInclusive(yearStartIso, yearEndIso);
  const intersectingPeriods = periods
    .filter((period) => period.employee_id === employee.id)
    .map((period) => ({
      ...period,
      clippedStart: maxIso(effectiveStart, period.start_date),
      clippedEnd: minIso(effectiveEnd, period.end_date ?? effectiveEnd)
    }))
    .filter((period) => period.clippedStart <= period.clippedEnd)
    .sort((first, second) => first.clippedStart.localeCompare(second.clippedStart));

  let target = 0;
  const missingRanges: { start: string; end: string }[] = [];
  let cursor = effectiveStart;

  for (const period of intersectingPeriods) {
    if (cursor < period.clippedStart) {
      const missingEnd = format(parseISO(period.clippedStart).getTime() - 86400000, "yyyy-MM-dd");
      missingRanges.push({ start: cursor, end: missingEnd });
    }

    const periodDays = daysBetweenInclusive(period.clippedStart, period.clippedEnd);
    target +=
      Number(period.annual_hours_full_time) *
      (Number(period.workload_percentage) / 100) *
      (periodDays / yearDays);

    const nextCursor = format(parseISO(period.clippedEnd).getTime() + 86400000, "yyyy-MM-dd");
    if (nextCursor > cursor) cursor = nextCursor;
  }

  if (cursor <= effectiveEnd) {
    missingRanges.push({ start: cursor, end: effectiveEnd });
  }

  return { target, missingRanges, effectiveStart, effectiveEnd };
}

export function annualTargetByPeriods(employee: Employee, periods: EmployeeWorkloadPeriod[], year: number) {
  return workloadTargetForRange(employee, periods, year);
}

export function operationalMonthlyTarget(
  employee: Employee,
  periods: EmployeeWorkloadPeriod[],
  rangeStartIso: string,
  rangeEndIso: string
): WorkloadTargetResult {
  const effectiveStart = maxIso(rangeStartIso, employee.start_date);
  const effectiveEnd = minIso(rangeEndIso, employee.end_date ?? rangeEndIso);

  if (effectiveStart > effectiveEnd) {
    return { target: 0, missingRanges: [], effectiveStart, effectiveEnd };
  }

  if (periods.length === 0) {
    return { target: annualTarget(employee) / 11, missingRanges: [], effectiveStart, effectiveEnd };
  }

  const effectiveDays = daysBetweenInclusive(effectiveStart, effectiveEnd);
  const intersectingPeriods = periods
    .filter((period) => period.employee_id === employee.id)
    .map((period) => ({
      ...period,
      clippedStart: maxIso(effectiveStart, period.start_date),
      clippedEnd: minIso(effectiveEnd, period.end_date ?? effectiveEnd)
    }))
    .filter((period) => period.clippedStart <= period.clippedEnd)
    .sort((first, second) => first.clippedStart.localeCompare(second.clippedStart));

  let target = 0;
  const missingRanges: { start: string; end: string }[] = [];
  let cursor = effectiveStart;

  for (const period of intersectingPeriods) {
    if (cursor < period.clippedStart) {
      const missingEnd = format(parseISO(period.clippedStart).getTime() - 86400000, "yyyy-MM-dd");
      missingRanges.push({ start: cursor, end: missingEnd });
    }

    const periodDays = daysBetweenInclusive(period.clippedStart, period.clippedEnd);
    target +=
      Number(period.annual_hours_full_time) *
      (Number(period.workload_percentage) / 100) *
      (periodDays / effectiveDays) /
      11;

    const nextCursor = format(parseISO(period.clippedEnd).getTime() + 86400000, "yyyy-MM-dd");
    if (nextCursor > cursor) cursor = nextCursor;
  }

  if (cursor <= effectiveEnd) {
    missingRanges.push({ start: cursor, end: effectiveEnd });
  }

  return { target, missingRanges, effectiveStart, effectiveEnd };
}

export function proportionalTarget(employee: Employee, month: number) {
  return (annualTarget(employee) * month) / 12;
}

export function proportionalTargetUntilDate(employee: Employee, year: number, today = new Date()) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (targetDate < start) return 0;

  const cappedDate = new Date(Math.min(targetDate.getTime(), end.getTime()));
  const elapsedDays = Math.floor((cappedDate.getTime() - start.getTime()) / 86400000) + 1;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return (annualTarget(employee) * elapsedDays) / totalDays;
}

export function proportionalTargetByPeriodsUntilDate(
  employee: Employee,
  periods: EmployeeWorkloadPeriod[],
  year: number,
  today = new Date()
) {
  const todayIso = format(dateOnly(today), "yyyy-MM-dd");
  return workloadTargetForRange(employee, periods, year, todayIso);
}

export function monthlyTarget(employee: Employee) {
  return annualTarget(employee) / 12;
}
