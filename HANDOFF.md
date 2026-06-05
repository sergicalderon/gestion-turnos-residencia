# Handoff - Gestion de turnos residencia

## Objetivo de la aplicacion

Aplicacion interna para gestionar turnos de una residencia. El objetivo es reemplazar o complementar planillas tipo Excel con una herramienta web que permita:

- Mantener empleados por departamento.
- Definir tipos de turno con codigo, color y horas computables.
- Asignar turnos en una planilla mensual por empleado y dia.
- Generar turnos desde patrones ciclicos.
- Registrar vacaciones y ausencias.
- Controlar horas mensuales y anuales frente a objetivos de jornada.
- Consultar resumen anual y seguimiento proporcional.
- Preparar reglas de cobertura minima/maxima por departamento y tipo de turno.

La app esta pensada como MVP operativo: interfaz sencilla, foco en planilla, Supabase como backend, despliegue en Vercel.

## Tecnologias utilizadas

- Next.js 14 con App Router.
- React 18.
- TypeScript.
- Tailwind CSS.
- Supabase:
  - Auth.
  - Postgres.
  - Row Level Security con politicas permisivas para usuarios autenticados.
- date-fns para calculos y formato de fechas.
- lucide-react para iconos.
- Vercel para produccion.

Scripts relevantes:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
```

## Arquitectura del proyecto

La aplicacion esta organizada como una app Next.js con paginas en `app/`, componentes compartidos en `components/`, logica de dominio en `lib/` y migraciones SQL en `supabase/migrations/`.

Flujo general:

- `app/layout.tsx` monta el layout global, autenticacion y navegacion.
- `components/auth-gate.tsx` protege la app mediante Supabase Auth.
- `components/sidebar.tsx` contiene la navegacion principal.
- Cada seccion funcional vive en una ruta de `app/`.
- `lib/supabase/client.ts` crea el cliente Supabase desde variables publicas.
- `lib/database.types.ts` contiene tipos TypeScript manuales del esquema Supabase.
- `lib/hours.ts` concentra calculos de horas, objetivos anuales y objetivos mensuales operativos.
- `lib/pattern-generation.ts` genera asignaciones de turnos desde patrones.
- `lib/pattern-analytics.ts` calcula estadisticas de patrones.
- `lib/dates.ts` centraliza utilidades de fechas.
- `lib/departments.ts` centraliza helpers de departamentos.

## Estructura de carpetas

```text
app/
  page.tsx                    Planilla mensual
  departamentos/page.tsx      Gestion de departamentos
  empleados/page.tsx          Gestion de empleados y periodos de jornada
  patrones/page.tsx           Patrones ciclicos y asignacion a empleados
  resumen-anual/page.tsx      Resumen anual y seguimiento proporcional
  tipos-turno/page.tsx        Gestion de tipos de turno
  vacaciones/page.tsx         Vacaciones y ausencias
  globals.css                 Estilos globales y tabla de planilla
  layout.tsx                  Layout raiz

components/
  auth-gate.tsx
  department-badge.tsx
  page-shell.tsx
  sidebar.tsx
  ui.tsx

lib/
  database.types.ts
  dates.ts
  departments.ts
  hours.ts
  pattern-analytics.ts
  pattern-generation.ts
  supabase/client.ts

supabase/migrations/
  202605310001_initial_schema.sql
  202605310002_shift_patterns.sql
  202606010001_employee_workload_periods.sql
  202606010002_departments.sql
  202606040001_department_shift_coverage_rules.sql

public/
  apple-touch-icon.png
  favicon-16x16.png
  favicon-32x32.png
```

## Funcionalidades implementadas

### Autenticacion

- Acceso mediante Supabase Auth.
- La app muestra un formulario de email y contrasena si no hay sesion.
- Los usuarios se gestionan desde Supabase.

### Departamentos

- Alta, edicion y activacion/desactivacion de departamentos.
- Colores por departamento.
- Conteo de empleados activos por departamento.
- Helpers para slugs y etiquetas.

### Empleados

- Alta, edicion e inactivacion/borrado protegido.
- Empleado vinculado a departamento.
- Periodos de jornada (`employee_workload_periods`) con:
  - porcentaje de jornada,
  - horas anuales de convenio/objetivo full time,
  - fecha inicio/fin,
  - notas.
- Triggers SQL para evitar solapes y sincronizar la jornada actual con la tabla `employees`.

### Tipos de turno

- Codigo, nombre, color, horas computables.
- Tipo global o asociado a departamento.
- Ejemplos iniciales: `M`, `T`, `MT`, `N`, `L`, `V`, `G`.

### Planilla mensual

- Vista tipo Excel por empleado y dia.
- Filtro por departamento.
- Navegacion por mes y ano.
- Zoom de tabla.
- Edicion de turnos por celda.
- Generacion desde patrones.
- Columnas finales actuales:
  - `Mes`: `horas_planificadas_mes / objetivo_mensual_operativo`.
  - `Dif.`: `horas_planificadas_mes - objetivo_mensual_operativo`.
- En movil se ocultan columnas resumen y se muestran datos resumidos dentro de la celda del empleado.

### Calculo de horas

- `assignmentHours`: suma horas computables de asignaciones.
- Calculo anual real por periodos de jornada.
- Calculo proporcional anual hasta una fecha.
- Objetivo mensual operativo:
  - `annual_hours_full_time * workload_percentage / 100 / 11`.
  - Se usa solo como referencia visual en la planilla mensual.
  - No reemplaza el objetivo anual real ni el historico.

### Patrones de turnos

- Definicion de patrones ciclicos.
- Dias de patron asociados a tipos de turno.
- Asignacion de patrones a empleados.
- Validacion de solapes por empleado.
- Generacion de turnos por rango, con opcion de sobrescribir o mantener existentes.
- Simulacion/analitica de equivalencia de patron.

### Vacaciones y ausencias

- Registro de rangos de ausencia por empleado.
- Asociacion de ausencia a tipo de turno.
- Reflejo automatico en planilla mediante asignaciones.

### Resumen anual

- Resumen anual completo:
  - horas planificadas del ano completo,
  - objetivo anual real,
  - diferencia anual.
- Seguimiento anual hasta hoy:
  - horas acumuladas,
  - objetivo proporcional hasta la fecha,
  - diferencia actual.

### Resumen diario por tipo de turno

Estado importante: esta funcionalidad fue implementada en la carpeta antigua, pero aun debe migrarse al repositorio Git conectado.

Incluye:

- Resumen debajo de la planilla mensual.
- Conteo por dia y tipo de turno.
- Respeta filtro de departamento.
- Cuenta solo empleados visibles.
- Permite seleccionar tipos de turno mostrados.
- Por defecto muestra solo turnos de cobertura/trabajo:
  - horas computables > 0,
  - excluye `L`, `V`, `VAC`, `VACACIONES`, `LIBRE`.
- Alineacion con columnas de dias.
- Scroll horizontal compartido con la tabla.
- Lectura opcional de reglas `department_shift_coverage_rules`.
- Si existe regla:
  - bajo minimo: rojo,
  - cumple: normal,
  - supera maximo: ambar.
- Si la tabla de reglas no existe todavia, la app no rompe y muestra solo conteos.

Archivos de esta funcionalidad pendientes de migrar al repo conectado:

- `app/page.tsx`
- `app/globals.css`
- `lib/database.types.ts`
- `supabase/migrations/202606040001_department_shift_coverage_rules.sql`

## Funcionalidades pendientes

- Migrar los cambios locales de resumen diario por turno al repositorio Git conectado.
- Subir esos cambios en una rama nueva y abrir PR hacia `main`.
- Aplicar la migracion `department_shift_coverage_rules` en Supabase antes o junto con el despliegue.
- Crear interfaz para gestionar reglas de cobertura por departamento.
- Definir datos iniciales de cobertura, por ejemplo:
  - Auxiliares, `M`, minimo 4.
  - Auxiliares, `T`, minimo 3.
  - Auxiliares, `N`, minimo 2.
- Ajustar objetivo mensual operativo por vacaciones cuando se implemente desglose mensual:
  - mes con vacaciones completas: objetivo operativo mensual = 0,
  - vacaciones parciales: reduccion proporcional.
- Revisar y reforzar RLS: actualmente las politicas son permisivas para usuarios autenticados.
- Automatizar generacion de tipos `database.types.ts` desde Supabase si se incorpora Supabase CLI.
- Confirmar estrategia de migraciones en produccion.

## Ultimos cambios realizados

### Cambios ya publicados en GitHub/Vercel previamente

Repositorio correcto:

```text
https://github.com/sergicalderon/gestion-turnos-residencia
```

Commit publicado:

```text
44ec691 Ajusta planilla mensual
```

Cambios:

- Eliminada columna `Ano` de la planilla mensual.
- Columnas finales de planilla mensual:
  - `Mes`
  - `Dif.`
- `Mes` muestra horas del mes frente a objetivo mensual operativo.
- Diferencia mensual usa horas del mes frente a objetivo mensual operativo.
- El resumen anual mantiene objetivo anual real.
- Se amplio el ancho/responsive de columnas resumen.

### Cambios locales pendientes de migrar

En la carpeta antigua:

```text
/Users/sergiocalderonlozano/DEVELOPER/Gestion de turnos
```

hay cambios no migrados al repo conectado:

- `app/page.tsx`
- `app/globals.css`
- `lib/database.types.ts`
- `supabase/migrations/202606040001_department_shift_coverage_rules.sql`

Estos implementan el resumen diario por turno y la tabla opcional de reglas de cobertura.

## Migraciones Supabase existentes

### `202605310001_initial_schema.sql`

Crea:

- Extension `pgcrypto`.
- `employees`.
- `shift_types`.
- `shift_assignments`.
- `absences`.
- Indices principales.
- Funcion `set_updated_at`.
- Triggers de `updated_at`.
- RLS y politicas permisivas para usuarios autenticados.
- Tipos de turno iniciales:
  - `M`, `T`, `MT`, `N`, `L`, `V`, `G`.

### `202605310002_shift_patterns.sql`

Crea:

- Extension `btree_gist`.
- `shift_patterns`.
- `shift_pattern_days`.
- `employee_shift_patterns`.
- Columnas en `shift_assignments`:
  - `source`,
  - `employee_shift_pattern_id`,
  - `generated_at`.
- Indices.
- Triggers de `updated_at`.
- Validacion de solapes de patrones por empleado.
- RLS y grants.

### `202606010001_employee_workload_periods.sql`

Crea:

- `employee_workload_periods`.
- Indices.
- Triggers:
  - cerrar periodo abierto anterior,
  - evitar solapes,
  - sincronizar jornada actual con `employees`.
- Inserta periodos iniciales desde empleados existentes.
- RLS y grants.

### `202606010002_departments.sql`

Crea:

- `departments`.
- Departamentos iniciales:
  - Enfermeria,
  - Auxiliares,
  - Limpieza,
  - Cocina,
  - Mantenimiento,
  - Administracion,
  - Coordinacion.
- Agrega `department_id` a `employees`.
- Migra categorias existentes a departamentos.
- Agrega `department_id` a `shift_types` y `shift_patterns`.
- Crea `user_departments`.
- Indices.
- RLS y grants.

### `202606040001_department_shift_coverage_rules.sql`

Estado: existe en carpeta antigua, pendiente de migrar al repo conectado.

Crea:

- `department_shift_coverage_rules`.

Campos:

- `id`
- `department_id`
- `shift_type_id`
- `day_of_week` nullable, ISO 1-7
- `min_required`
- `max_allowed` nullable
- `is_active`
- `created_at`
- `updated_at`

Tambien crea:

- Indices unicos para regla general y regla por dia.
- Indices por departamento y tipo.
- Trigger `updated_at`.
- RLS, grants y politica permisiva.

## Variables de entorno necesarias

En desarrollo, crear `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_publishable_key
```

Notas:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` apuntan al mismo valor en la configuracion actual.
- No copiar `.env.local` entre carpetas ni al repositorio.
- En Vercel deben existir las mismas variables.

## Problemas conocidos

### Dos carpetas de trabajo

Hay dos carpetas:

```text
/Users/sergiocalderonlozano/DEVELOPER/Gestion de turnos
/Users/sergiocalderonlozano/DEVELOPER/gestion-turnos-residencia
```

- La primera es la carpeta antigua/desconectada.
- La segunda es el repositorio Git correcto conectado a GitHub.
- A partir del nuevo workspace, se debe trabajar solo en:

```text
/Users/sergiocalderonlozano/DEVELOPER/gestion-turnos-residencia
```

### Cambios locales no migrados

La funcionalidad de resumen diario por turno esta en la carpeta antigua y aun debe copiarse al repo conectado.

No copiar:

- `.env.local`
- `tsconfig.tsbuildinfo`
- `node_modules`
- `.next`
- `.git`

Copiar solo:

- `app/page.tsx`
- `app/globals.css`
- `lib/database.types.ts`
- `supabase/migrations/202606040001_department_shift_coverage_rules.sql`

### Permisos del workspace anterior

En la sesion anterior, Codex no tenia permiso de escritura sobre el repo conectado porque el workspace seguia apuntando a la carpeta antigua. El nuevo workspace debe abrir directamente el repo conectado.

### GitHub/Vercel

- Vercel despliega desde GitHub.
- El repo correcto es:

```text
owner: sergicalderon
repo: gestion-turnos-residencia
branch base: main
```

- Para cada cambio futuro:
  - crear rama nueva,
  - aplicar cambios,
  - ejecutar lint/build,
  - commit,
  - push,
  - PR hacia `main`.

### Base de datos

- Las migraciones no se aplican automaticamente por Vercel.
- Antes de desplegar cambios que dependan de nuevas tablas, aplicar migracion en Supabase.
- La UI de resumen diario tolera la ausencia de `department_shift_coverage_rules`, pero para min/max hay que aplicar la migracion.

## Proximos pasos recomendados

1. Abrir nuevo workspace en:

```text
/Users/sergiocalderonlozano/DEVELOPER/gestion-turnos-residencia
```

2. Confirmar Git:

```bash
git remote -v
git status
git branch --show-current
```

3. Crear rama:

```bash
git switch -c recover-local-changes
```

4. Copiar desde la carpeta antigua solo estos archivos:

```text
app/page.tsx
app/globals.css
lib/database.types.ts
supabase/migrations/202606040001_department_shift_coverage_rules.sql
```

5. Ejecutar:

```bash
npm install
npm run lint
npm run build
git diff --stat
git diff -- app/page.tsx app/globals.css lib/database.types.ts supabase/migrations/202606040001_department_shift_coverage_rules.sql
```

6. Revisar diff.

7. Commit:

```bash
git add app/page.tsx app/globals.css lib/database.types.ts supabase/migrations/202606040001_department_shift_coverage_rules.sql
git commit -m "Recover local changes from previous workspace"
```

8. Push:

```bash
git push -u origin recover-local-changes
```

9. Abrir PR hacia `main`.

10. Aplicar migracion Supabase `202606040001_department_shift_coverage_rules.sql`.

11. Mergear PR y verificar despliegue Vercel.

## Convenciones de codigo utilizadas

- TypeScript estricto segun configuracion del proyecto.
- Componentes React funcionales.
- Estado local con `useState`.
- Derivaciones con `useMemo`.
- Cargas de datos con `useCallback` + `useEffect`.
- Tailwind para estilos.
- Componentes UI simples en `components/ui.tsx`.
- Iconos de `lucide-react`.
- Fechas ISO `yyyy-MM-dd`.
- `date-fns` para fechas y calculos de calendario.
- Tablas con clases CSS estables en `app/globals.css`.
- Evitar refactors amplios si no son necesarios.
- Mantener migraciones SQL cronologicas con prefijo timestamp.
- No commitear:
  - `.env.local`,
  - `node_modules`,
  - `.next`,
  - `tsconfig.tsbuildinfo`.
- Antes de publicar:
  - `npm run lint`,
  - `npm run build`.

## Estado de verificacion reciente

En la carpeta antigua, antes del handoff:

```bash
npm run lint
npm run build
```

pasaron sin errores tras implementar el resumen diario por turno.

La verificacion visual en navegador de Codex fue limitada por politica del navegador/local workspace, pero el servidor local compilo y respondio.


