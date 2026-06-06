import type { CellHookData } from "jspdf-autotable";
import type { Worksheet } from "exceljs";

export const DEFAULT_RESIDENCE_NAME = "Residencia";

export type ScheduleExportDay = {
  iso: string;
  day: string;
  weekday: string;
};

export type ScheduleExportShift = {
  code: string;
  color: string;
};

export type ScheduleExportEmployee = {
  name: string;
  department: string;
  monthHours: number;
  monthTarget: number;
  shifts: Record<string, ScheduleExportShift | undefined>;
};

export type ScheduleExportSummary = {
  code: string;
  name: string;
  color: string;
  counts: Record<string, number>;
};

export type ScheduleExportSnapshot = {
  residenceName: string;
  department: string;
  period: string;
  generatedAt: Date;
  days: ScheduleExportDay[];
  employees: ScheduleExportEmployee[];
  dailySummary: ScheduleExportSummary[];
};

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function exportFilename(snapshot: ScheduleExportSnapshot, extension: string) {
  return `planilla-${safeFilename(snapshot.department)}-${safeFilename(snapshot.period)}.${extension}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((character) => character + character).join("")
    : normalized.padEnd(6, "f").slice(0, 6);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ] as [number, number, number];
}

function excelColor(hex: string) {
  return `FF${hex.replace("#", "").padEnd(6, "F").slice(0, 6).toUpperCase()}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportSchedulePdf(snapshot: ScheduleExportSnapshot) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const generatedLabel = snapshot.generatedAt.toLocaleString("es-ES");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const drawHeader = () => {
    doc.setTextColor(23, 32, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(snapshot.residenceName, 10, 10);
    doc.setFontSize(11);
    doc.text(`Planilla mensual · ${snapshot.department}`, 10, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(snapshot.period, 10, 21);
    doc.text(`Generado: ${generatedLabel}`, pageWidth - 10, 10, { align: "right" });
  };

  const dayColumns = snapshot.days.map((day) => `${day.weekday.toUpperCase()}\n${day.day}`);
  const mainBody = snapshot.employees.map((employee) => [
    employee.name,
    ...snapshot.days.map((day) => employee.shifts[day.iso]?.code ?? ""),
    employee.monthHours.toFixed(1)
  ]);
  const dayColumnStyles = Object.fromEntries(
    snapshot.days.map((_, index) => [index + 1, { cellWidth: 9, halign: "center" as const }])
  );

  autoTable(doc, {
    head: [["Empleado", ...dayColumns, "Horas"]],
    body: mainBody,
    startY: 27,
    margin: { top: 27, right: 10, bottom: 18, left: 10 },
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1.2, valign: "middle", lineColor: [210, 218, 213], lineWidth: 0.15 },
    headStyles: { fillColor: [237, 242, 239], textColor: [23, 32, 27], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold" },
      ...dayColumnStyles,
      [snapshot.days.length + 1]: { cellWidth: 17, halign: "right", fontStyle: "bold" }
    },
    didParseCell: (data: CellHookData) => {
      if (data.section !== "body" || data.column.index === 0 || data.column.index > snapshot.days.length) return;
      const employee = snapshot.employees[data.row.index];
      const day = snapshot.days[data.column.index - 1];
      const shift = employee?.shifts[day?.iso];
      if (shift) data.cell.styles.fillColor = hexToRgb(shift.color);
    },
    didDrawPage: drawHeader
  });

  const lastTable = doc as typeof doc & { lastAutoTable: { finalY: number } };
  const summaryStartY = lastTable.lastAutoTable.finalY + 7;
  autoTable(doc, {
    head: [["Resumen diario por turno", ...dayColumns]],
    body: snapshot.dailySummary.map((summary) => [
      `${summary.code} · ${summary.name}`,
      ...snapshot.days.map((day) => summary.counts[day.iso] ?? 0)
    ]),
    startY: summaryStartY,
    margin: { top: 27, right: 10, bottom: 18, left: 10 },
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1.1, valign: "middle", lineColor: [210, 218, 213], lineWidth: 0.15 },
    headStyles: { fillColor: [237, 242, 239], textColor: [23, 32, 27], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" }, ...dayColumnStyles },
    didParseCell: (data: CellHookData) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const summary = snapshot.dailySummary[data.row.index];
      if (summary) data.cell.styles.fillColor = hexToRgb(summary.color);
    },
    didDrawPage: drawHeader
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(210, 218, 213);
    doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 105, 96);
    doc.text(`Generado: ${generatedLabel}`, 10, pageHeight - 7);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - 10, pageHeight - 7, { align: "right" });
  }

  doc.save(exportFilename(snapshot, "pdf"));
}

export async function exportScheduleExcel(snapshot: ScheduleExportSnapshot) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = snapshot.residenceName;
  workbook.created = snapshot.generatedAt;

  const titleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF17201B" } };
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEDF2EF" } };
  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FFD2DAD5" } },
    left: { style: "thin" as const, color: { argb: "FFD2DAD5" } },
    bottom: { style: "thin" as const, color: { argb: "FFD2DAD5" } },
    right: { style: "thin" as const, color: { argb: "FFD2DAD5" } }
  };

  const addSheetHeading = (sheet: Worksheet, title: string, lastColumn: number) => {
    sheet.mergeCells(1, 1, 1, lastColumn);
    sheet.getCell(1, 1).value = snapshot.residenceName;
    sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    sheet.getCell(1, 1).fill = titleFill;
    sheet.mergeCells(2, 1, 2, lastColumn);
    sheet.getCell(2, 1).value = `${title} · ${snapshot.department} · ${snapshot.period}`;
    sheet.getCell(2, 1).font = { bold: true, size: 12 };
    sheet.mergeCells(3, 1, 3, lastColumn);
    sheet.getCell(3, 1).value = `Generado: ${snapshot.generatedAt.toLocaleString("es-ES")}`;
    sheet.getCell(3, 1).font = { italic: true, color: { argb: "FF5A6960" } };
  };

  const schedule = workbook.addWorksheet("Planilla mensual", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  });
  const scheduleColumns = snapshot.days.length + 3;
  addSheetHeading(schedule, "Planilla mensual", scheduleColumns);
  const scheduleHeaders = ["Empleado", "Departamento", ...snapshot.days.map((day) => `${day.weekday.toUpperCase()} ${day.day}`), "Horas mes"];
  schedule.addRow([]);
  const scheduleHeader = schedule.addRow(scheduleHeaders);
  scheduleHeader.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  snapshot.employees.forEach((employee) => {
    const row = schedule.addRow([
      employee.name,
      employee.department,
      ...snapshot.days.map((day) => employee.shifts[day.iso]?.code ?? ""),
      employee.monthHours
    ]);
    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    snapshot.days.forEach((day, index) => {
      const shift = employee.shifts[day.iso];
      if (shift) row.getCell(index + 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelColor(shift.color) } };
    });
    row.getCell(scheduleColumns).numFmt = "0.0";
  });
  schedule.views = [{ state: "frozen", xSplit: 2, ySplit: 5 }];
  schedule.getColumn(1).width = 28;
  schedule.getColumn(2).width = 20;
  snapshot.days.forEach((_, index) => { schedule.getColumn(index + 3).width = 5; });
  schedule.getColumn(scheduleColumns).width = 12;
  schedule.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: scheduleColumns } };

  const daily = workbook.addWorksheet("Resumen diario", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  });
  const dailyColumns = snapshot.days.length + 2;
  addSheetHeading(daily, "Resumen diario por turno", dailyColumns);
  daily.addRow([]);
  const dailyHeader = daily.addRow(["Código", "Turno", ...snapshot.days.map((day) => `${day.weekday.toUpperCase()} ${day.day}`)]);
  dailyHeader.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  snapshot.dailySummary.forEach((summary) => {
    const row = daily.addRow([summary.code, summary.name, ...snapshot.days.map((day) => summary.counts[day.iso] ?? 0)]);
    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelColor(summary.color) } };
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  });
  daily.views = [{ state: "frozen", xSplit: 2, ySplit: 5 }];
  daily.getColumn(1).width = 10;
  daily.getColumn(2).width = 24;
  snapshot.days.forEach((_, index) => { daily.getColumn(index + 3).width = 5; });

  const hours = workbook.addWorksheet("Resumen de horas");
  addSheetHeading(hours, "Resumen de horas mensuales", 5);
  hours.addRow([]);
  const hoursHeader = hours.addRow(["Empleado", "Departamento", "Horas mes", "Objetivo", "Diferencia"]);
  hoursHeader.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
  });
  snapshot.employees.forEach((employee) => {
    const row = hours.addRow([
      employee.name,
      employee.department,
      employee.monthHours,
      employee.monthTarget,
      employee.monthHours - employee.monthTarget
    ]);
    row.eachCell((cell) => { cell.border = thinBorder; });
    [3, 4, 5].forEach((column) => { row.getCell(column).numFmt = "0.0"; });
  });
  hours.views = [{ state: "frozen", ySplit: 5 }];
  hours.getColumn(1).width = 30;
  hours.getColumn(2).width = 22;
  hours.getColumn(3).width = 14;
  hours.getColumn(4).width = 14;
  hours.getColumn(5).width = 14;

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    exportFilename(snapshot, "xlsx")
  );
}
