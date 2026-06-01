"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, LayoutGrid, LogOut, Menu, Plane, Repeat, Shapes, UsersRound, X } from "lucide-react";
import clsx from "clsx";
import { GhostButton } from "@/components/ui";

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

export function MobileNavigation({ onSignOut }: { onSignOut: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white px-3 py-2 lg:hidden">
        <button
          type="button"
          className="inline-flex min-h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-ink shadow-subtle"
          aria-label={open ? "Cerrar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-moss">Residencia</p>
          <h1 className="truncate text-base font-semibold">Gestión de turnos</h1>
        </div>
        <GhostButton type="button" onClick={onSignOut} className="min-h-10 px-2.5 sm:px-3">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </GhostButton>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
          <button
            type="button"
            className="absolute inset-0 bg-ink/35"
            aria-label="Cerrar menu"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[min(82vw,320px)] flex-col border-r border-line bg-white shadow-subtle">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-moss">Residencia</p>
                <h2 className="mt-1 text-lg font-semibold">Gestión de turnos</h2>
              </div>
              <button
                type="button"
                className="inline-flex min-h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-ink"
                aria-label="Cerrar menu"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "mb-1 flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition",
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
        </div>
      ) : null}
    </>
  );
}
