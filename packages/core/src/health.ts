/** Semáforo de salud financiera (PRD 7.8). Umbrales de referencia, no reglas absolutas. */

export type Level = "good" | "warn" | "bad";

export type Indicator = {
  key: "committed" | "msi" | "credit" | "emergency" | "savings" | "ant" | "lent";
  label: string;
  /** Valor numérico (porcentaje o meses); null si no hay datos para calcularlo. */
  value: number | null;
  unit: "%" | "meses";
  level: Level | null;
  /** Explicación corta en lenguaje simple. */
  help: string;
};

export type HealthInput = {
  monthlyIncomeCents: number;
  /** Mensualidades de préstamos + cuotas MSI (+ fijos conocidos). */
  committedMonthlyCents: number;
  msiMonthlyCents: number;
  creditUsedCents: number;
  creditLimitCents: number;
  emergencySavedCents: number;
  essentialMonthlyCents: number;
  /** Lo que salió en el último mes completo (gastos con cuenta + pagos de tarjeta). */
  monthlySpendingCents: number;
  antMonthlyCents: number;
  lentCents: number;
};

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

/** Nivel para un indicador donde "menos es mejor". */
const lowerIsBetter = (v: number | null, good: number, bad: number): Level | null =>
  v == null ? null : v < good ? "good" : v <= bad ? "warn" : "bad";

/** Nivel para un indicador donde "más es mejor". */
const higherIsBetter = (v: number | null, good: number, bad: number): Level | null =>
  v == null ? null : v >= good ? "good" : v >= bad ? "warn" : "bad";

export function healthIndicators(i: HealthInput): Indicator[] {
  const income = i.monthlyIncomeCents;
  const committed = pct(i.committedMonthlyCents, income);
  const msi = pct(i.msiMonthlyCents, income);
  const credit = pct(i.creditUsedCents, i.creditLimitCents);
  const emergency = i.essentialMonthlyCents > 0 ? Math.round((i.emergencySavedCents / i.essentialMonthlyCents) * 10) / 10 : null;
  const savings = income > 0 && i.monthlySpendingCents > 0 ? pct(income - i.monthlySpendingCents, income) : null;
  const ant = pct(i.antMonthlyCents, income);
  const lent = pct(i.lentCents, income);

  return [
    {
      key: "committed",
      label: "Ingreso comprometido",
      value: committed,
      unit: "%",
      level: lowerIsBetter(committed, 35, 50),
      help: "Mensualidades y MSI que ya debes antes de cobrar. Menos de 35% deja margen.",
    },
    {
      key: "msi",
      label: "Cuotas MSI",
      value: msi,
      unit: "%",
      level: lowerIsBetter(msi, 10, 20),
      help: "Meses sin intereses que pagas cada mes. Arriba de 10% conviene no sacar más.",
    },
    {
      key: "credit",
      label: "Uso de crédito",
      value: credit,
      unit: "%",
      level: lowerIsBetter(credit, 30, 50),
      help: "Lo que llevas en tus tarjetas contra su límite. Menos de 30% cuida tu historial.",
    },
    {
      key: "emergency",
      label: "Fondo de emergencia",
      value: emergency,
      unit: "meses",
      level: higherIsBetter(emergency, 3, 1),
      help: "Cuántos meses de gastos esenciales cubre lo que tienes apartado. La meta: 3 a 6.",
    },
    {
      key: "savings",
      label: "Tasa de ahorro",
      value: savings,
      unit: "%",
      level: higherIsBetter(savings, 15, 5),
      help: "Lo que te sobró del ingreso el último mes completo. 15% o más es sano.",
    },
    {
      key: "ant",
      label: "Gasto hormiga",
      value: ant,
      unit: "%",
      level: lowerIsBetter(ant, 5, 10),
      help: "Antojos y gastos chicos de los últimos 30 días contra tu ingreso.",
    },
    {
      key: "lent",
      label: "Dinero prestado",
      value: lent,
      unit: "%",
      level: lowerIsBetter(lent, 10, 25),
      help: "Lo que te deben contra tu ingreso mensual.",
    },
  ];
}

export type BudgetStatus = { spentCents: number; limitCents: number; pct: number; level: Level };

/** Presupuesto: verde < 80 %, amarillo 80–99 %, rojo ≥ 100 % (PRD 7.7). */
export function budgetStatus(spentCents: number, limitCents: number): BudgetStatus {
  const p = limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0;
  return { spentCents, limitCents, pct: p, level: p >= 100 ? "bad" : p >= 80 ? "warn" : "good" };
}

/** Simulador "¿Me alcanza?" (PRD 7.9): cuota y cómo cambia el % de MSI. */
export function simulateInstallment(i: { priceCents: number; months: number; monthlyIncomeCents: number; msiMonthlyCents: number }) {
  const monthly = Math.round(i.priceCents / i.months);
  return {
    monthlyCents: monthly,
    msiPctBefore: pct(i.msiMonthlyCents, i.monthlyIncomeCents),
    msiPctAfter: pct(i.msiMonthlyCents + monthly, i.monthlyIncomeCents),
  };
}
