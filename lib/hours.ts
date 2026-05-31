import type { Employee, ShiftAssignment, ShiftType } from "@/lib/database.types";

export function assignmentHours(assignments: ShiftAssignment[], shiftTypes: ShiftType[]) {
  const byId = new Map(shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
  return assignments.reduce((total, assignment) => {
    return total + Number(byId.get(assignment.shift_type_id)?.computable_hours ?? 0);
  }, 0);
}

export function proportionalTarget(employee: Employee, month: number) {
  const annualTarget = Number(employee.annual_target_hours);
  const percentage = Number(employee.workday_percentage) / 100;
  return (annualTarget * percentage * month) / 12;
}

export function monthlyTarget(employee: Employee) {
  const annualTarget = Number(employee.annual_target_hours);
  const percentage = Number(employee.workday_percentage) / 100;
  return (annualTarget * percentage) / 12;
}
