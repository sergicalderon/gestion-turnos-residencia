import { differenceInCalendarDays, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enumerateDates, maxIsoDate, minIsoDate } from "@/lib/dates";
import type { Database, Employee, EmployeeShiftPattern, ShiftPattern, ShiftPatternDay } from "@/lib/database.types";

type Supabase = SupabaseClient<Database>;
type ShiftAssignmentInsert = Database["public"]["Tables"]["shift_assignments"]["Insert"];

export type GeneratePatternParams = {
  startDate: string;
  endDate: string;
  employeeIds?: string[];
  overwriteExisting: boolean;
};

export type GeneratePatternResult = {
  generated: number;
  skippedExisting: number;
  skippedInactiveEmployees: number;
  skippedEmptyPatterns: number;
};

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

export async function generateShiftsFromPatterns(
  client: Supabase,
  params: GeneratePatternParams
): Promise<GeneratePatternResult> {
  if (params.endDate < params.startDate) {
    throw new Error("La fecha fin no puede ser anterior a la fecha inicio.");
  }

  let assignmentsQuery = client
    .from("employee_shift_patterns")
    .select("*")
    .eq("is_active", true)
    .lte("start_date", params.endDate)
    .or(`end_date.is.null,end_date.gte.${params.startDate}`);

  if (params.employeeIds?.length) {
    assignmentsQuery = assignmentsQuery.in("employee_id", params.employeeIds);
  }

  const { data: employeePatterns, error: employeePatternError } = await assignmentsQuery;
  if (employeePatternError) throw new Error(employeePatternError.message);
  if (!employeePatterns?.length) {
    return { generated: 0, skippedExisting: 0, skippedInactiveEmployees: 0, skippedEmptyPatterns: 0 };
  }

  const employeeIds = Array.from(new Set(employeePatterns.map((item) => item.employee_id)));
  const patternIds = Array.from(new Set(employeePatterns.map((item) => item.pattern_id)));

  const [
    { data: employees, error: employeesError },
    { data: patterns, error: patternsError },
    { data: patternDays, error: patternDaysError },
    { data: existingAssignments, error: existingError }
  ] = await Promise.all([
    client.from("employees").select("*").in("id", employeeIds),
    client.from("shift_patterns").select("*").in("id", patternIds).eq("is_active", true),
    client.from("shift_pattern_days").select("*").in("pattern_id", patternIds).order("day_index"),
    client
      .from("shift_assignments")
      .select("*")
      .in("employee_id", employeeIds)
      .gte("date", params.startDate)
      .lte("date", params.endDate)
  ]);

  const error = employeesError ?? patternsError ?? patternDaysError ?? existingError;
  if (error) throw new Error(error.message);

  const employeesById = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const patternsById = new Map((patterns ?? []).map((pattern) => [pattern.id, pattern]));
  const daysByPatternId = new Map<string, ShiftPatternDay[]>();
  for (const day of patternDays ?? []) {
    const days = daysByPatternId.get(day.pattern_id) ?? [];
    days.push(day);
    daysByPatternId.set(day.pattern_id, days);
  }

  const existingByCell = new Map((existingAssignments ?? []).map((assignment) => [`${assignment.employee_id}-${assignment.date}`, assignment]));
  const rows: ShiftAssignmentInsert[] = [];
  let skippedExisting = 0;
  let skippedInactiveEmployees = 0;
  let skippedEmptyPatterns = 0;

  for (const assignment of employeePatterns as EmployeeShiftPattern[]) {
    const employee = employeesById.get(assignment.employee_id) as Employee | undefined;
    const pattern = patternsById.get(assignment.pattern_id) as ShiftPattern | undefined;
    const days = daysByPatternId.get(assignment.pattern_id) ?? [];

    if (!employee?.active) {
      skippedInactiveEmployees += 1;
      continue;
    }
    if (!pattern || days.length === 0) {
      skippedEmptyPatterns += 1;
      continue;
    }

    const effectiveStart = maxIsoDate(params.startDate, assignment.start_date, employee.start_date);
    const effectiveEnd = minIsoDate(
      params.endDate,
      assignment.end_date ?? params.endDate,
      employee.end_date ?? params.endDate
    );

    if (effectiveEnd < effectiveStart) continue;

    for (const date of enumerateDates(effectiveStart, effectiveEnd)) {
      const existing = existingByCell.get(`${assignment.employee_id}-${date}`);
      if (existing && !params.overwriteExisting) {
        skippedExisting += 1;
        continue;
      }

      const offset = differenceInCalendarDays(parseISO(date), parseISO(assignment.start_date));
      const cycleIndex = mod(Number(assignment.start_day_index) + offset, days.length);
      const patternDay = days[cycleIndex];
      rows.push({
        employee_id: assignment.employee_id,
        date,
        shift_type_id: patternDay.shift_type_id,
        source: "pattern",
        source_id: assignment.id,
        employee_shift_pattern_id: assignment.id,
        generated_at: new Date().toISOString()
      });
    }
  }

  if (rows.length === 0) {
    return { generated: 0, skippedExisting, skippedInactiveEmployees, skippedEmptyPatterns };
  }

  const result = params.overwriteExisting
    ? await client.from("shift_assignments").upsert(rows, { onConflict: "employee_id,date" })
    : await client.from("shift_assignments").insert(rows);

  if (result.error) throw new Error(result.error.message);

  return {
    generated: rows.length,
    skippedExisting,
    skippedInactiveEmployees,
    skippedEmptyPatterns
  };
}
