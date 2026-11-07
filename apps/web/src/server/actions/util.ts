import { randomUUID } from "node:crypto";
import { parseMoney } from "@gp/core";
import { category, creditLine, db, moneyAccount } from "@gp/db";
import { and, eq } from "drizzle-orm";

export type ActionState = { error: string | null; ok?: boolean; at?: number };

export const ok = (): ActionState => ({ error: null, ok: true, at: Date.now() });
export const fail = (error: string): ActionState => ({ error, at: Date.now() });

export const newId = () => randomUUID();

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const optStr = (f: FormData, k: string) => str(f, k) || null;

export function int(f: FormData, k: string, min: number, max: number): number | null {
  const v = Number(str(f, k));
  return Number.isInteger(v) && v >= min && v <= max ? v : null;
}

/** Monto obligatorio y positivo, en centavos. */
export function money(f: FormData, k: string): number | null {
  const v = parseMoney(str(f, k));
  return v != null && v > 0 ? v : null;
}

/** Monto opcional: vacío → null; inválido → undefined. */
export function optMoney(f: FormData, k: string): number | null | undefined {
  const raw = str(f, k);
  if (!raw) return null;
  const v = parseMoney(raw);
  return v != null && v >= 0 ? v : undefined;
}

export function isoDate(f: FormData, k: string): string | null {
  const v = str(f, k);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

// Verificaciones de propiedad (RN-09): nunca confiar en ids que manda el navegador.

export async function ownAccount(userId: string, id: string | null) {
  if (!id) return null;
  const [row] = await db.select().from(moneyAccount).where(and(eq(moneyAccount.id, id), eq(moneyAccount.userId, userId)));
  return row ?? null;
}

export async function ownLine(userId: string, id: string | null) {
  if (!id) return null;
  const [row] = await db.select().from(creditLine).where(and(eq(creditLine.id, id), eq(creditLine.userId, userId)));
  return row ?? null;
}

export async function ownCategory(userId: string, id: string | null) {
  if (!id) return null;
  const [row] = await db.select().from(category).where(and(eq(category.id, id), eq(category.userId, userId)));
  return row ?? null;
}
