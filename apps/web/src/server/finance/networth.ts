import { installmentProgress, netWorth } from "@gp/core";
import { receivableBalances } from "./mutations";
import { cardSummaries, toInstallment, type Finance } from "./overview";

/** Patrimonio neto (RF-42): cuentas + por cobrar − tarjetas − MSI pendientes − préstamos. */
export async function computeNetWorth(userId: string, f: Finance) {
  const receivables = (await receivableBalances(userId)).filter((r) => r.status === "active");
  const assets = [
    ...f.accounts.map((a) => ({ label: a.name, cents: a.balanceCents, note: a.kind === "savings" ? "Ahorro" : a.kind === "cash" ? "Efectivo" : "Débito" })),
    ...(receivables.length ? [{ label: "Me deben", cents: receivables.reduce((s, r) => s + r.pendingCents, 0), note: `${receivables.length} préstamos` }] : []),
  ];

  const summaries = cardSummaries(f);
  const cards = f.lines
    .filter((l) => l.kind === "card")
    .map((l) => {
      const unpaid = f.cycleViews.filter((c) => c.lineId === l.id && (c.status === "cut" || c.status === "overdue" || c.status === "open"));
      return { label: l.name, cents: unpaid.reduce((s, c) => s + c.amountCents, 0), note: "Por pagar y ciclo actual" };
    })
    .filter((c) => c.cents > 0);
  const msi = summaries.flatMap((s) =>
    s.msi.map((m) => ({ label: m.row.product, cents: installmentProgress(toInstallment(m.row), s.open.cut).pendingCents, note: `MSI en ${s.line.name}` })),
  );
  const loans = f.lines
    .filter((l) => l.kind === "loan")
    .map((l) => ({
      label: l.name,
      cents: l.remainingPayments != null ? (l.fixedPaymentCents ?? 0) * l.remainingPayments : 0,
      note: l.remainingPayments != null ? `${l.remainingPayments} mensualidades` : "Captura las mensualidades restantes para incluirlo",
    }));
  const liabilities = [...cards, ...msi.filter((m) => m.cents > 0), ...loans];

  const totals = netWorth({
    accountsCents: f.accounts.reduce((s, a) => s + a.balanceCents, 0),
    receivablesCents: receivables.reduce((s, r) => s + r.pendingCents, 0),
    cardDebtCents: cards.reduce((s, c) => s + c.cents, 0),
    msiPendingCents: msi.reduce((s, m) => s + m.cents, 0),
    loansPendingCents: loans.reduce((s, l) => s + l.cents, 0),
  });
  return { ...totals, assetItems: assets, liabilityItems: liabilities, loansIncomplete: loans.some((l) => l.cents === 0) };
}
