/** Espacios compartidos (RF-39): saldos por persona y transferencias mínimas para quedar a mano. */

export type SharedEntry =
  | { kind: "expense"; paidBy: string; amountCents: number; shares: { userId: string; shareCents: number }[] }
  | { kind: "settlement"; paidBy: string; paidTo: string; amountCents: number };

/** Reparte un monto en partes iguales; los centavos que sobran van a los primeros. */
export function splitEqually(amountCents: number, userIds: string[]) {
  const base = Math.floor(amountCents / userIds.length);
  let rest = amountCents - base * userIds.length;
  return userIds.map((userId) => ({ userId, shareCents: base + (rest-- > 0 ? 1 : 0) }));
}

/** Saldo neto de cada persona: positivo = le deben; negativo = debe. */
export function spaceBalances(entries: SharedEntry[], members: string[]) {
  const bal = new Map(members.map((m) => [m, 0]));
  const add = (id: string, v: number) => bal.set(id, (bal.get(id) ?? 0) + v);
  for (const e of entries) {
    if (e.kind === "expense") {
      add(e.paidBy, e.amountCents);
      for (const s of e.shares) add(s.userId, -s.shareCents);
    } else {
      add(e.paidBy, e.amountCents);
      add(e.paidTo, -e.amountCents);
    }
  }
  return bal;
}

/** Transferencias sugeridas (codicioso: el que más debe le paga al que más le deben). */
export function settleUp(balances: Map<string, number>) {
  const debtors = [...balances].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = [...balances].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  const out: { from: string; to: string; amountCents: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i]!.v, creditors[j]!.v);
    if (pay > 0) out.push({ from: debtors[i]!.id, to: creditors[j]!.id, amountCents: pay });
    debtors[i]!.v -= pay;
    creditors[j]!.v -= pay;
    if (debtors[i]!.v === 0) i++;
    if (creditors[j]!.v === 0) j++;
  }
  return out;
}

/** Proyectos (RF-40): meses para recuperar la inversión con la ganancia mensual promedio. */
export function paybackMonths(investmentCents: number, avgMonthlyProfitCents: number) {
  if (investmentCents <= 0) return 0;
  if (avgMonthlyProfitCents <= 0) return null;
  return Math.round((investmentCents / avgMonthlyProfitCents) * 10) / 10;
}
