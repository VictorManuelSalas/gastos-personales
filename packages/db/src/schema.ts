import { bigint, boolean, date, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

// ── Autenticación (tablas que usa Better Auth) ────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** "admin" | "user". El primer usuario registrado es admin. */
  role: text("role").notNull().default("user"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ── Invitaciones (registro cerrado, RN-10) ────────────────────────────────────

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  /** Si se define, solo ese correo puede usar la invitación. */
  email: text("email"),
  note: text("note"),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
  usedAt: ts("used_at"),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ── Finanzas (Fase 1) ─────────────────────────────────────────────────────────
// Todo el dinero en centavos enteros (RN-11). Todas las tablas llevan user_id
// y cada consulta filtra por él (RN-09).

const day = (name: string) => date(name, { mode: "string" });
const cents = (name: string) => bigint(name, { mode: "number" });
const owner = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/** Cuentas de débito, efectivo o ahorro. Su suma (las marcadas) es el saldo disponible. */
export const moneyAccount = pgTable(
  "money_account",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    kind: text("kind").$type<"debit" | "cash" | "savings">().notNull(),
    name: text("name").notNull(),
    balanceCents: cents("balance_cents").notNull().default(0),
    /** Si cuenta para el "disponible" de la quincena (ahorro normalmente no). */
    inAvailable: boolean("in_available").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    archivedAt: ts("archived_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("money_account_user_idx").on(t.userId)],
);

/** Tarjetas de crédito y préstamos con pago mensual (RN-01). */
export const creditLine = pgTable(
  "credit_line",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    kind: text("kind").$type<"card" | "loan">().notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#8fa8ff"),
    cutDay: integer("cut_day").notNull(),
    dueKind: text("due_kind").$type<"days_after" | "fixed_day">().notNull(),
    dueValue: integer("due_value").notNull(),
    businessDayPolicy: text("business_day_policy").$type<"none" | "previous" | "next">().notNull().default("none"),
    creditLimitCents: cents("credit_limit_cents"),
    /** Préstamos: mensualidad fija. */
    fixedPaymentCents: cents("fixed_payment_cents"),
    /** Préstamos: mensualidades restantes (opcional, RN-24). */
    remainingPayments: integer("remaining_payments"),
    /** Primer corte que se sigue en la app (no se muestran ciclos anteriores como vencidos). */
    trackingFrom: day("tracking_from").notNull(),
    archivedAt: ts("archived_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("credit_line_user_idx").on(t.userId)],
);

/**
 * Datos capturados de un ciclo. Los ciclos se calculan a partir de la regla de la
 * tarjeta; aquí solo se guarda lo que el usuario agrega o corrige (RN-05).
 */
export const cycle = pgTable(
  "cycle",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    creditLineId: text("credit_line_id")
      .notNull()
      .references(() => creditLine.id, { onDelete: "cascade" }),
    cutDate: day("cut_date").notNull(),
    /** Fecha límite corregida a mano (si difiere de la calculada). */
    dueOverride: day("due_override"),
    statementCents: cents("statement_cents"),
    minimumCents: cents("minimum_cents"),
    /** Quincena asignada a mano (RN-04, movimiento manual). */
    paydayOverride: day("payday_override"),
    paidAt: day("paid_at"),
    paidCents: cents("paid_cents"),
    note: text("note"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cycle_line_cut_uq").on(t.creditLineId, t.cutDate), index("cycle_user_idx").on(t.userId)],
);

/** Compras a meses sin intereses (RN-07). */
export const installment = pgTable(
  "installment",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    creditLineId: text("credit_line_id")
      .notNull()
      .references(() => creditLine.id, { onDelete: "cascade" }),
    product: text("product").notNull(),
    priceCents: cents("price_cents").notNull(),
    months: integer("months").notNull(),
    monthlyCents: cents("monthly_cents"),
    firstCut: day("first_cut").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("installment_user_idx").on(t.userId)],
);

/** Fuentes de ingreso recurrentes (sueldos, negocio…) con monto esperado (RN-22). */
export const incomeSource = pgTable(
  "income_source",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    name: text("name").notNull(),
    accountId: text("account_id").references(() => moneyAccount.id, { onDelete: "set null" }),
    expectedCents: cents("expected_cents").notNull(),
    estimation: text("estimation").$type<"fixed" | "avg3">().notNull().default("fixed"),
    /** "paydays": cada día de cobro; "monthly": un día fijo al mes. */
    schedule: text("schedule").$type<"paydays" | "monthly">().notNull().default("paydays"),
    monthlyDay: integer("monthly_day"),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("income_source_user_idx").on(t.userId)],
);

/** Categorías de gasto e ingreso (dos niveles). */
export const category = pgTable(
  "category",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("•"),
    color: text("color").notNull().default("#8fa8ff"),
    kind: text("kind").$type<"expense" | "income">().notNull(),
    klass: text("class").$type<"essential" | "lifestyle" | "savings">().notNull().default("lifestyle"),
    isAnt: boolean("is_ant").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: ts("archived_at"),
  },
  (t) => [index("category_user_idx").on(t.userId)],
);

/** Movimientos: gastos, ingresos, pagos de tarjeta y ajustes. */
export const transaction = pgTable(
  "txn",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    kind: text("kind").$type<"expense" | "income" | "card_payment" | "adjustment">().notNull(),
    amountCents: cents("amount_cents").notNull(),
    date: day("date").notNull(),
    categoryId: text("category_id").references(() => category.id, { onDelete: "set null" }),
    accountId: text("account_id").references(() => moneyAccount.id, { onDelete: "set null" }),
    creditLineId: text("credit_line_id").references(() => creditLine.id, { onDelete: "set null" }),
    /** Pago de tarjeta: corte del ciclo pagado. Ingreso recurrente: día de cobro. */
    periodDate: day("period_date"),
    incomeSourceId: text("income_source_id").references(() => incomeSource.id, { onDelete: "set null" }),
    merchant: text("merchant"),
    note: text("note"),
    origin: text("origin").$type<"web" | "telegram" | "import">().notNull().default("web"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("txn_user_date_idx").on(t.userId, t.date), index("txn_line_idx").on(t.creditLineId, t.date)],
);

export type User = typeof user.$inferSelect;
export type Invitation = typeof invitation.$inferSelect;
export type MoneyAccount = typeof moneyAccount.$inferSelect;
export type CreditLine = typeof creditLine.$inferSelect;
export type CycleRow = typeof cycle.$inferSelect;
export type InstallmentRow = typeof installment.$inferSelect;
export type IncomeSource = typeof incomeSource.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Txn = typeof transaction.$inferSelect;
