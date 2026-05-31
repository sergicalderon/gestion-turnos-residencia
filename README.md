# Gestión de turnos

MVP interno para gestionar turnos de una residencia con Next.js, Supabase, Tailwind y Vercel.

## Funcionalidades

- Empleados: alta, edición, inactivación y borrado protegido si tienen turnos.
- Tipos de turno: códigos, colores y horas computables.
- Planilla mensual tipo Excel por empleado y día.
- Control de horas mensual y acumulado anual.
- Vacaciones y ausencias con reflejo automático en planilla.
- Acceso interno mediante Supabase Auth.

## Configuración

Crea `.env.local` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_publishable_key
```

Aplica la migración SQL en `supabase/migrations/202605310001_initial_schema.sql`.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

En Vercel, añade las mismas variables de entorno antes de desplegar.
