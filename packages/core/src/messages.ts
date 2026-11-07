import { parseMoney } from "./money";

/**
 * Lector local de mensajes del bot (sin IA): resuelve los formatos comunes en
 * milisegundos. La IA queda para mensajes ambiguos, voz y fotos (Fase 2, parte 2).
 */

export type NamedRef = { id: string; name: string };

export type ParsedMessage =
  | { type: "expense"; amountCents: number; description: string; source: { kind: "account" | "line"; id: string } | null }
  | { type: "income"; amountCents: number; description: string; accountId: string | null }
  | { type: "contribution"; amountCents: number; goalId: string | null; goalQuery: string }
  | { type: "lend"; amountCents: number; contactName: string; description: string; source: { kind: "account" | "line"; id: string } | null }
  | { type: "repayment"; amountCents: number; contactName: string }
  | { type: "statement"; amountCents: number; lineId: string | null; lineQuery: string }
  | { type: "missing_amount"; description: string }
  | { type: "unknown" };

/** Minúsculas, sin acentos, sin signos. */
export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ$.,+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const AMOUNT = /(?:^|\s)\$?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?=\s|$)/;
const FILLER = new Set(["con", "en", "de", "del", "la", "el", "por", "pague", "pago", "gaste", "gasto", "compre", "fue", "mi", "tarjeta"]);

function takeAmount(text: string): { cents: number | null; rest: string } {
  const m = text.match(AMOUNT);
  if (!m) return { cents: null, rest: text };
  const cents = parseMoney(m[1]!);
  return { cents, rest: (text.slice(0, m.index) + " " + text.slice(m.index! + m[0].length)).replace(/\s+/g, " ").trim() };
}

/** Busca un nombre (tarjeta, cuenta, meta) como palabras completas; gana el más largo. */
function findRef(text: string, refs: NamedRef[]): { ref: NamedRef; rest: string } | null {
  const padded = ` ${text} `;
  const hits = refs
    .map((ref) => ({ ref, n: normalizeText(ref.name) }))
    .filter(({ n }) => n && padded.includes(` ${n} `))
    .sort((a, b) => b.n.length - a.n.length);
  const hit = hits[0];
  if (!hit) return null;
  return { ref: hit.ref, rest: padded.replace(` ${hit.n} `, " ").replace(/\s+/g, " ").trim() };
}

/** Coincidencia por prefijo: "japon" → "Viaje a Japón", "mercado" → "Mercado Pago". */
function findByPrefix(query: string, refs: NamedRef[]): NamedRef | null {
  const q = normalizeText(query);
  if (!q) return null;
  return (
    refs.find((r) => normalizeText(r.name) === q) ??
    refs.find((r) => normalizeText(r.name).startsWith(q)) ??
    refs.find((r) => normalizeText(r.name).split(" ").some((w) => w.startsWith(q))) ??
    null
  );
}

const clean = (s: string) =>
  s
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .join(" ")
    .trim();

export function parseMessage(raw: string, ctx: { lines: NamedRef[]; accounts: NamedRef[]; goals: NamedRef[] }): ParsedMessage {
  if (raw.trim().startsWith("/")) return { type: "unknown" };
  const text = normalizeText(raw);
  if (!text) return { type: "unknown" };

  // "estado bbva 4568.71" → monto del estado de cuenta.
  let m = text.match(/^estado (.+)$/);
  if (m) {
    const { cents, rest } = takeAmount(m[1]!);
    if (cents == null) return { type: "missing_amount", description: rest };
    const line = findByPrefix(rest, ctx.lines);
    return { type: "statement", amountCents: cents, lineId: line?.id ?? null, lineQuery: rest };
  }

  // "aparta 500 japon", "ahorre 300 para emergencia" → aporte a meta.
  m = text.match(/^(aparta|apartar|aparte|ahorra|ahorrar|ahorre|abona a) (.+)$/);
  if (m) {
    const { cents, rest } = takeAmount(m[2]!);
    if (cents == null) return { type: "missing_amount", description: rest };
    const q = rest.replace(/^(para|a|en) /, "");
    return { type: "contribution", amountCents: cents, goalId: findByPrefix(q, ctx.goals)?.id ?? null, goalQuery: q };
  }

  // "fer abono 500", "fer me pago 500", "abono de fer 500" → abono de alguien que te debe.
  m = text.match(/^(\S+) (?:me )?(?:abono|pago|dio|devolvio|regreso) (.+)$/) ?? text.match(/^abono (?:de )?(\S+) (.+)$/);
  if (m && AMOUNT.test(` ${m[2]} `)) {
    const { cents } = takeAmount(m[2]!);
    if (cents != null) return { type: "repayment", amountCents: cents, contactName: m[1]! };
  }

  // "preste 500 a fer para el gas", "le preste 2000 a liz" → préstamo.
  m = text.match(/^(?:le )?preste (.+?) a (\S+)(?: (?:para|por) (.+))?$/);
  if (m) {
    const amount = takeAmount(m[1]!);
    const src = findRef(amount.rest, [...ctx.lines, ...ctx.accounts]);
    if (amount.cents == null) return { type: "missing_amount", description: text };
    return {
      type: "lend",
      amountCents: amount.cents,
      contactName: m[2]!,
      description: (m[3] ?? "prestamo").replace(/^(el|la|los|las|un|una) /, "").trim(),
      source: src ? { kind: ctx.lines.some((l) => l.id === src.ref.id) ? "line" : "account", id: src.ref.id } : null,
    };
  }

  // "+1500 horas extra" → ingreso.
  if (text.startsWith("+")) {
    const { cents, rest } = takeAmount(text.slice(1));
    if (cents == null) return { type: "missing_amount", description: rest };
    const acc = findRef(rest, ctx.accounts);
    return { type: "income", amountCents: cents, description: clean(acc?.rest ?? rest), accountId: acc?.ref.id ?? null };
  }

  // Todo lo demás con monto es un gasto: "tacos 180 bbva", "uber 95 con nu".
  const { cents, rest } = takeAmount(text);
  if (cents == null) {
    return rest.split(" ").length <= 4 ? { type: "missing_amount", description: rest } : { type: "unknown" };
  }
  const line = findRef(rest, ctx.lines);
  const acc = line ? null : findRef(rest, ctx.accounts);
  const source = line ? { kind: "line" as const, id: line.ref.id } : acc ? { kind: "account" as const, id: acc.ref.id } : null;
  return { type: "expense", amountCents: cents, description: clean(line?.rest ?? acc?.rest ?? rest), source };
}

/**
 * Recupera las palabras originales (con acentos y mayúsculas) de una descripción
 * normalizada: ("Café 65 NU", "cafe") → "Café".
 */
export function originalWords(raw: string, description: string): string {
  const wanted = description.split(" ").filter(Boolean);
  const words = raw.split(/\s+/);
  const out: string[] = [];
  for (const w of wanted) {
    const hit = words.find((r) => normalizeText(r) === w);
    out.push(hit ? hit.replace(/[^\p{L}\p{N}]+$/u, "") : w);
  }
  return out.join(" ");
}
