import {
  assignPayday,
  cycleContaining,
  cyclesWithDueBetween,
  DEFAULT_PAYDAYS,
  dayInMonth,
  installmentProgress,
  installmentsDueAt,
  maxDate,
  monthIndex,
  monthStart,
  parse,
  parsePaydayRule,
  paydaysBetween,
  projectQuincenas,
  today as todayISO,
  upcomingPaydays,
  type CreditRule,
  type Cycle,
  type FlowItem,
  type Installment,
  type ISODate,
  type PendingPayment,
  type QuincenaBlock,
} from "@gp/core";
import {
  creditLine,
  cycle,
  db,
  incomeSource,
  installment,
  moneyAccount,
  transaction,
  type CreditLine,
  type CycleRow,
  type IncomeSource,
  type InstallmentRow,
  user,
} from "@gp/db";
import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";

export const QUINCENAS_AHEAD = 6;

export function ruleOf(line: Pick<CreditLine, "cutDay" | "dueKind" | "dueValue" | "businessDayPolicy">): CreditRule {
  return {
    cutDay: line.cutDay,
    due: line.dueKind === "days_after" ? { kind: "days_after", days: line.dueValue } : { kind: "fixed_day", day: line.dueValue },
    policy: line.businessDayPolicy,
  };
}

const toInstallment = (r: InstallmentRow): Installment => ({
  priceCents: r.priceCents,
  months: r.months,
  monthlyCents: r.monthlyCents,
  firstCut: r.firstCut,
});

export type CycleView = Cycle & {
  lineId: string;
  row: CycleRow | null;
  amountCents: number;
  /** De dónde sale el monto. */
  source: "statement" | "calculated" | "estimate" | "fixed";
  spentCents: number;
  msiCents: number;
  payday: ISODate;
  status: "upcoming" | "open" | "cut" | "paid" | "overdue" | "empty";
};

/** Todo lo que necesitan las vistas de un usuario, cargado en una sola pasada. */
export async function loadFinance(userId: string, now = todayISO()) {
  const since = monthStart(now, -8);
  const [[prefs], accounts, lines, cycleRows, installments, sources, incomes, expenses] = await Promise.all([
    db.select({ payDays: user.payDays, policy: user.paydayPolicy }).from(user).where(eq(user.id, userId)),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, userId), isNull(moneyAccount.archivedAt))).orderBy(moneyAccount.createdAt),
    db.select().from(creditLine).where(and(eq(creditLine.userId, userId), isNull(creditLine.archivedAt))).orderBy(creditLine.createdAt),
    db.select().from(cycle).where(eq(cycle.userId, userId)),
    db.select().from(installment).where(eq(installment.userId, userId)).orderBy(installment.createdAt),
    db.select().from(incomeSource).where(and(eq(incomeSource.userId, userId), eq(incomeSource.active, true))).orderBy(incomeSource.createdAt),
    db
      .select()
      .from(transaction)
      .where(and(eq(transaction.userId, userId), eq(transaction.kind, "income"), isNotNull(transaction.incomeSourceId)))
      .orderBy(desc(transaction.periodDate)),
    db
      .select({ creditLineId: transaction.creditLineId, date: transaction.date, amountCents: transaction.amountCents })
      .from(transaction)
      .where(and(eq(transaction.userId, userId), eq(transaction.kind, "expense"), isNotNull(transaction.creditLineId), gte(transaction.date, since))),
  ]);

  const rule = (prefs && parsePaydayRule(prefs.payDays, prefs.policy)) ?? DEFAULT_PAYDAYS;
  const balanceCents = accounts.filter((a) => a.inAvailable).reduce((s, a) => s + a.balanceCents, 0);
  const paydays = upcomingPaydays(rule, now, QUINCENAS_AHEAD + 1);
  const horizonEnd = paydays[paydays.length - 1]!;

  const rowsByKey = new Map(cycleRows.map((r) => [`${r.creditLineId}|${r.cutDate}`, r]));

  /** Calcula monto, estado y quincena de un ciclo (RN-05). */
  function viewCycle(line: CreditLine, c: Cycle): CycleView {
    const row = rowsByKey.get(`${line.id}|${c.cut}`) ?? null;
    const due = row?.dueOverride ?? c.due;
    const lineInst = installments.filter((i) => i.creditLineId === line.id).map(toInstallment);
    const msiCents = line.kind === "card" ? installmentsDueAt(lineInst, c.cut) : 0;
    const spentCents = expenses
      .filter((e) => e.creditLineId === line.id && e.date >= c.start && e.date <= c.cut)
      .reduce((s, e) => s + e.amountCents, 0);

    let amountCents: number;
    let source: CycleView["source"];
    if (line.kind === "loan") {
      amountCents = row?.statementCents ?? line.fixedPaymentCents ?? 0;
      source = row?.statementCents != null ? "statement" : "fixed";
    } else if (row?.statementCents != null) {
      amountCents = row.statementCents;
      source = "statement";
    } else if (c.cut < now) {
      amountCents = spentCents + msiCents;
      source = "calculated";
    } else {
      // Ciclo abierto o futuro: lo registrado o el promedio de los últimos 3 estados de cuenta.
      const last = cycleRows
        .filter((r) => r.creditLineId === line.id && r.statementCents != null && r.cutDate < now)
        .sort((a, b) => b.cutDate.localeCompare(a.cutDate))
        .slice(0, 3);
      const avg = last.length ? Math.round(last.reduce((s, r) => s + r.statementCents!, 0) / last.length) : 0;
      amountCents = Math.max(spentCents + msiCents, avg);
      source = "estimate";
    }

    const paid = Boolean(row?.paidAt);
    const status: CycleView["status"] = paid
      ? "paid"
      : c.start > now
        ? "upcoming"
        : c.cut >= now
          ? "open"
        : amountCents <= 0
          ? "empty"
          : due < now
            ? "overdue"
            : "cut";
    return {
      ...c,
      due,
      lineId: line.id,
      row,
      amountCents: paid ? (row?.paidCents ?? amountCents) : amountCents,
      source,
      spentCents,
      msiCents,
      payday: row?.paydayOverride ?? assignPayday(rule, due),
      status,
    };
  }

  /** Préstamos con mensualidades restantes: no proyectar más allá de la última. */
  function loanActiveAt(line: CreditLine, cut: ISODate) {
    if (line.kind !== "loan" || line.remainingPayments == null) return true;
    return monthIndex(cut) - monthIndex(line.trackingFrom) < line.remainingPayments;
  }

  // Ciclos que importan para las quincenas: desde el inicio del seguimiento hasta el horizonte.
  const cycleViews: CycleView[] = lines.flatMap((line) =>
    cyclesWithDueBetween(ruleOf(line), monthStart(line.trackingFrom, -1), horizonEnd)
      .filter((c) => c.cut >= line.trackingFrom && loanActiveAt(line, c.cut))
      .map((c) => viewCycle(line, c)),
  );

  const items: FlowItem[] = [];
  for (const cv of cycleViews) {
    if (cv.amountCents <= 0) continue;
    const line = lines.find((l) => l.id === cv.lineId)!;
    items.push({
      id: `c:${cv.lineId}:${cv.cut}`,
      kind: line.kind,
      label: line.name,
      date: cv.due,
      payday: cv.payday,
      amountCents: cv.amountCents,
      direction: "out",
      status: cv.status === "paid" ? "done" : "pending",
      estimated: cv.source === "estimate" || cv.source === "calculated",
      ref: { lineId: cv.lineId, cut: cv.cut, color: line.color },
    });
  }

  // Ingresos esperados vs. reales (RN-22).
  const currentPayday = paydays[0]!;
  for (const src of sources) {
    const confirmed = incomes.filter((t) => t.incomeSourceId === src.id);
    const expected =
      src.estimation === "avg3" && confirmed.length
        ? Math.round(confirmed.slice(0, 3).reduce((s, t) => s + t.amountCents, 0) / Math.min(3, confirmed.length))
        : src.expectedCents;
    // No se proyectan cobros anteriores al alta de la fuente (ya están en el saldo).
    const since = maxDate(currentPayday, todayISO(undefined, src.createdAt));
    const dates =
      src.schedule === "monthly" && src.monthlyDay
        ? monthlyDates(src.monthlyDay, since, horizonEnd)
        : paydaysBetween(rule, since, horizonEnd);
    for (const d of dates) {
      const hit = confirmed.find((t) => t.periodDate === d);
      items.push({
        id: `i:${src.id}:${d}`,
        kind: "income",
        label: src.name,
        date: d,
        payday: assignPayday(rule, d),
        amountCents: hit?.amountCents ?? expected,
        direction: "in",
        status: hit ? "done" : "pending",
        estimated: !hit,
        ref: { sourceId: src.id, period: d, accountId: src.accountId ?? "" },
      });
    }
  }

  const quincenas: QuincenaBlock[] = projectQuincenas({ today: now, balanceCents, rule, items, count: QUINCENAS_AHEAD });

  return { now, accounts, lines, installments, sources, cycleViews, balanceCents, quincenas, viewCycle, rule };
}

function monthlyDates(day: number, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let m = monthStart(from);
  while (m <= to) {
    const { y, m: mm } = parse(m);
    const d = dayInMonth(y, mm, day);
    if (d >= from && d <= to) out.push(d);
    m = monthStart(m, 1);
  }
  return out;
}

/** Resumen por tarjeta: ciclo actual, próximo pago y MSI. */
export function cardSummaries(f: Awaited<ReturnType<typeof loadFinance>>) {
  return f.lines.map((line) => {
    const views = f.cycleViews.filter((c) => c.lineId === line.id);
    // Primer pago pendiente: ciclos cortados (o que cortan hoy con estado de cuenta);
    // en préstamos, la siguiente mensualidad sin pagar.
    const nextPayment =
      views.find(
        (c) =>
          c.amountCents > 0 &&
          (c.status === "cut" ||
            c.status === "overdue" ||
            (c.status === "open" && c.source === "statement") ||
            (line.kind === "loan" && (c.status === "open" || c.status === "upcoming"))),
      ) ?? null;
    const open = f.viewCycle(line, cycleContaining(f.now, ruleOf(line)));
    const msi = f.installments
      .filter((i) => i.creditLineId === line.id)
      .map((i) => ({ row: i, progress: installmentProgress(toInstallment(i), open.cut) }))
      .filter((x) => !x.progress.done);
    return { line, open, nextPayment, msi };
  });
}

export { toInstallment };
export type Finance = Awaited<ReturnType<typeof loadFinance>>;
export type { CreditLine, IncomeSource };

/** ¿Este ciclo es un pago por hacer? (cortado, vencido, cortó hoy con estado de cuenta, o mensualidad de préstamo). */
export function isPayable(cv: CycleView, kind: "card" | "loan") {
  if (cv.status === "paid" || cv.amountCents <= 0) return false;
  return (
    cv.status === "cut" ||
    cv.status === "overdue" ||
    (cv.status === "open" && cv.source === "statement") ||
    (kind === "loan" && (cv.status === "open" || cv.status === "upcoming"))
  );
}

/** Pagos pendientes para los avisos de Telegram. */
export function pendingPayments(f: Finance): PendingPayment[] {
  const out: PendingPayment[] = [];
  for (const cv of f.cycleViews) {
    const line = f.lines.find((l) => l.id === cv.lineId);
    if (!line) continue;
    const payable = isPayable(cv, line.kind);
    const needsStatement = line.kind === "card" && cv.cut === f.now && cv.row?.statementCents == null;
    if (!payable && !needsStatement) continue;
    out.push({
      lineId: line.id,
      lineName: line.name,
      kind: line.kind,
      cut: cv.cut,
      due: cv.due,
      payday: cv.payday,
      amountCents: payable ? cv.amountCents : 0,
      needsStatement,
    });
  }
  return out;
}
