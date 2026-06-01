import type { Department } from "@/lib/database.types";

export const ALL_DEPARTMENTS = "all";

export function normalizeDepartmentName(name: string) {
  return name.trim().toLowerCase();
}

export function departmentSlug(name: string) {
  return normalizeDepartmentName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function findDepartmentByParam(departments: Department[], value: string | null) {
  if (!value || value === ALL_DEPARTMENTS) return null;
  return departments.find((department) => department.id === value || departmentSlug(department.name) === value) ?? null;
}

export function departmentLabel(department?: Department | null) {
  return department?.name ?? "Sin departamento";
}

export function departmentColor(department?: Department | null) {
  return department?.color || "#eef2ef";
}

export function activeDepartmentOptions(departments: Department[]) {
  return departments.filter((department) => department.is_active).sort((a, b) => a.name.localeCompare(b.name));
}
