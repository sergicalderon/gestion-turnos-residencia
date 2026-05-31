import { addDays, eachDayOfInterval, endOfMonth, format, isWithinInterval, parseISO, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

export function monthDays(year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end }).map((date) => ({
    date,
    iso: format(date, "yyyy-MM-dd"),
    day: format(date, "d"),
    weekday: format(date, "EEEEE", { locale: es })
  }));
}

export function monthRange(year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  return {
    start,
    end,
    startIso: format(start, "yyyy-MM-dd"),
    endIso: format(end, "yyyy-MM-dd")
  };
}

export function monthLabel(year: number, month: number) {
  return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });
}

export function enumerateDates(startIso: string, endIso: string) {
  const dates: string[] = [];
  let current = parseISO(startIso);
  const end = parseISO(endIso);
  while (current <= end) {
    dates.push(format(current, "yyyy-MM-dd"));
    current = addDays(current, 1);
  }
  return dates;
}

export function maxIsoDate(...dates: string[]) {
  return dates.reduce((max, date) => (date > max ? date : max));
}

export function minIsoDate(...dates: string[]) {
  return dates.reduce((min, date) => (date < min ? date : min));
}

export function dateIsWithinMonthEmployment(dateIso: string, startIso: string, endIso: string | null) {
  const date = parseISO(dateIso);
  const start = parseISO(startIso);
  const end = endIso ? parseISO(endIso) : new Date(9999, 11, 31);
  return isWithinInterval(date, { start, end });
}
