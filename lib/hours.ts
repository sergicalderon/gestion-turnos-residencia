import type { Employee, ShiftAssignment, ShiftType } from "@/lib/database.types";

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

export function monthlyTarget(employee: Employee) {
  return annualTarget(employee) / 12;
}
