"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, LayoutGrid, Plane, Repeat, Shapes, UsersRound } from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/", label: "Planilla", icon: LayoutGrid },
  { href: "/empleados", label: "Empleados", icon: UsersRound },
  { href: "/departamentos", label: "Departamentos", icon: Shapes },
  { href: "/tipos-turno", label: "Tipos de turno", icon: ClipboardList },
  { href: "/patrones", label: "Patrones de turno", icon: Repeat },
  { href: "/vacaciones", label: "Vacaciones", icon: Plane },
  { href: "/resumen-anual", label: "Resumen anual", icon: CalendarDays }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-line bg-white lg:block">
      <div className="border-b border-line px-5 py-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Residencia</p>
        <h1 className="mt-1 text-xl font-semibold">Gestión de turnos</h1>
      </div>
      <nav className="p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-mint text-ink" : "text-moss hover:bg-paper hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
