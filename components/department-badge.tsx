import type { Department } from "@/lib/database.types";
import { departmentColor, departmentLabel } from "@/lib/departments";

export function DepartmentBadge({ department }: { department?: Department | null }) {
  return (
    <span
      className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold text-ink"
      style={{ backgroundColor: departmentColor(department) }}
    >
      {departmentLabel(department)}
    </span>
  );
}
