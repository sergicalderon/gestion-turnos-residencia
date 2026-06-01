import { addDays, differenceInCalendarDays, format, getDaysInYear, parseISO } from "date-fns";
import type { ShiftPatternDay, ShiftType } from "@/lib/database.types";

export type PatternCycleStats = {
  sequence: string;
  cycleDays: number;
  workedShiftsPerCycle: number;
  hoursPerCycle: number;
  theoreticalAnnualHours: number;
};

export type PatternSimulationParams = {
  year: number;
  startDate: string;
  startDayIndex: number;
  fullTimeAnnualHours: number;
  rangeMode: "year" | "custom";
  customStartDate: string;
  customEndDate: string;
};

export type PatternSimulationResult = {
  rangeStart: string;
  rangeEnd: string;
  totalHours: number;
  workedDays: number;
  freeDays: number;
  countsByShiftTypeId: Record<string, number>;
  differenceFromFullTimeAnnualHours: number;
};

export type WorkloadEquivalenceLabel = "parcial" | "parcial alta" | "jornada completa" | "exceso de jornada";

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function orderedPatternDays(days: ShiftPatternDay[]) {
  return [...days].sort((first, second) => first.day_index - second.day_index);
}

function shiftHours(shiftTypeId: string, shiftTypeById: Map<string, ShiftType>) {
  return Number(shiftTypeById.get(shiftTypeId)?.computable_hours ?? 0);
}

export function patternCycleStats(
  days: ShiftPatternDay[],
  shiftTypeById: Map<string, ShiftType>,
  year: number
): PatternCycleStats {
  const orderedDays = orderedPatternDays(days);
  const hoursPerCycle = orderedDays.reduce((total, day) => total + shiftHours(day.shift_type_id, shiftTypeById), 0);
  const cycleDays = orderedDays.length;

  return {
    sequence: orderedDays.map((day) => shiftTypeById.get(day.shift_type_id)?.code ?? "?").join(" - "),
    cycleDays,
    workedShiftsPerCycle: orderedDays.filter((day) => shiftHours(day.shift_type_id, shiftTypeById) > 0).length,
    hoursPerCycle,
    theoreticalAnnualHours: cycleDays > 0 ? (hoursPerCycle * getDaysInYear(new Date(year, 0, 1))) / cycleDays : 0
  };
}

export function workloadEquivalencePercentage(patternAnnualHours: number, fullTimeAnnualHours: number) {
  if (fullTimeAnnualHours <= 0) return 0;
  return (patternAnnualHours / fullTimeAnnualHours) * 100;
}

export function workloadEquivalenceLabel(percentage: number): WorkloadEquivalenceLabel {
  if (percentage < 50) return "parcial";
  if (percentage >= 95 && percentage <= 105) return "jornada completa";
  if (percentage > 105) return "exceso de jornada";
  return "parcial alta";
}

export function simulatePatternYear(
  days: ShiftPatternDay[],
  shiftTypeById: Map<string, ShiftType>,
  params: PatternSimulationParams
): PatternSimulationResult {
  const orderedDays = orderedPatternDays(days);
  const yearStart = `${params.year}-01-01`;
  const yearEnd = `${params.year}-12-31`;
  const rangeStart = params.rangeMode === "custom" ? params.customStartDate : yearStart;
  const rangeEnd = params.rangeMode === "custom" ? params.customEndDate : yearEnd;
  const countsByShiftTypeId: Record<string, number> = {};

  if (!orderedDays.length || !rangeStart || !rangeEnd || rangeEnd < rangeStart) {
    return {
      rangeStart,
      rangeEnd,
      totalHours: 0,
      workedDays: 0,
      freeDays: 0,
      countsByShiftTypeId,
      differenceFromFullTimeAnnualHours: -Number(params.fullTimeAnnualHours || 0)
    };
  }

  let totalHours = 0;
  let workedDays = 0;
  let freeDays = 0;
  let current = parseISO(rangeStart);
  const end = parseISO(rangeEnd);

  while (current <= end) {
    const dateIso = format(current, "yyyy-MM-dd");
    const offset = differenceInCalendarDays(current, parseISO(params.startDate));
    const cycleIndex = mod(Number(params.startDayIndex) + offset, orderedDays.length);
    const shiftTypeId = orderedDays[cycleIndex]?.shift_type_id;
    const hours = shiftHours(shiftTypeId, shiftTypeById);

    countsByShiftTypeId[shiftTypeId] = (countsByShiftTypeId[shiftTypeId] ?? 0) + 1;
    totalHours += hours;
    if (hours > 0) workedDays += 1;
    else freeDays += 1;

    current = addDays(parseISO(dateIso), 1);
  }

  return {
    rangeStart,
    rangeEnd,
    totalHours,
    workedDays,
    freeDays,
    countsByShiftTypeId,
    differenceFromFullTimeAnnualHours: totalHours - Number(params.fullTimeAnnualHours || 0)
  };
}
