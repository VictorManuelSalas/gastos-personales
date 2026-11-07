/**
 * Fechas en la zona horaria del usuario (RNF-09). Para la Fase 0 solo se usa
 * el próximo día de cobro; en la Fase 1 esta lógica se mueve a packages/core.
 */
export const TZ = "America/Mexico_City";

/** Fecha civil (año, mes 1-12, día) de "hoy" en la zona dada. */
export function todayIn(tz = TZ, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Próximo cobro con días de pago "15 y último del mes" (RN-03).
 * Si hoy es día de cobro, devuelve hoy con daysUntil = 0.
 */
export function nextPayday(today = todayIn()) {
  const { y, m, d } = today;
  const payDay = d <= 15 ? 15 : lastDayOfMonth(y, m);
  const from = Date.UTC(y, m - 1, d);
  const to = Date.UTC(y, m - 1, payDay);
  return { date: new Date(to), daysUntil: Math.round((to - from) / 86_400_000) };
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export function greeting(now = new Date()) {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now),
  );
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function formatShortDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

// Fechas ISO "YYYY-MM-DD" (sin zona) para mostrar en pantalla.
const isoToDate = (s: string) => new Date(`${s}T12:00:00Z`);

/** "17 nov" */
export const fmtShort = (s: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(isoToDate(s)).replace(".", "");

/** "lun 17 nov" */
export const fmtDay = (s: string) =>
  new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(isoToDate(s))
    .replace(/\./g, "")
    .replace(",", "");

/** "domingo 15 de noviembre" */
export const fmtLong = (s: string) =>
  new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(isoToDate(s)).replace(",", "");
