import { addDays, iso, weekday, type ISODate } from "./dates";

/** n-ésimo día de la semana del mes (p. ej. tercer lunes). */
function nthWeekday(y: number, m: number, dow: number, n: number): ISODate {
  const first = iso(y, m, 1);
  const offset = (dow - weekday(first) + 7) % 7;
  return addDays(first, offset + (n - 1) * 7);
}

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function easter(y: number): ISODate {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return iso(y, month, day);
}

const cache = new Map<number, Set<ISODate>>();

/**
 * Días inhábiles bancarios en México: descansos obligatorios de la LFT (art. 74)
 * más los días que los bancos cierran (Jueves y Viernes Santo, 2 nov, 12 dic).
 */
export function bankHolidays(y: number): Set<ISODate> {
  const hit = cache.get(y);
  if (hit) return hit;
  const e = easter(y);
  const days = new Set<ISODate>([
    iso(y, 1, 1),
    nthWeekday(y, 2, 1, 1), // Constitución: primer lunes de febrero
    nthWeekday(y, 3, 1, 3), // Natalicio de Juárez: tercer lunes de marzo
    addDays(e, -3), // Jueves Santo
    addDays(e, -2), // Viernes Santo
    iso(y, 5, 1),
    iso(y, 9, 16),
    iso(y, 11, 2),
    nthWeekday(y, 11, 1, 3), // Revolución: tercer lunes de noviembre
    iso(y, 12, 12),
    iso(y, 12, 25),
  ]);
  if ((y - 2024) % 6 === 0) days.add(iso(y, 10, 1)); // Transmisión del Poder Ejecutivo
  cache.set(y, days);
  return days;
}

export function isBusinessDay(d: ISODate): boolean {
  const w = weekday(d);
  if (w === 0 || w === 6) return false;
  return !bankHolidays(Number(d.slice(0, 4))).has(d);
}

export function previousBusinessDay(d: ISODate): ISODate {
  let x = d;
  while (!isBusinessDay(x)) x = addDays(x, -1);
  return x;
}

export function nextBusinessDay(d: ISODate): ISODate {
  let x = d;
  while (!isBusinessDay(x)) x = addDays(x, 1);
  return x;
}
