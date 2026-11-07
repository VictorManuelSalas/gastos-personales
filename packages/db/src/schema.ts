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
  // Preferencias (RN-03, 7.11). Se leen directo de la BD, no viajan en la sesión.
  /** Días de cobro separados por coma; "last" = último día del mes. */
  payDays: text("pay_days").notNull().default("15,last"),
  paydayPolicy: text("payday_policy").$type<"none" | "previous_business">().notNull().default("none"),
  telegramChatId: text("telegram_chat_id"),
  telegramLinkedAt: timestamp("telegram_linked_at", { withTimezone: true }),
  /** Días antes de la fecha límite en que se avisa, separados por coma. */
  reminderDays: text("reminder_days").notNull().default("5,3,1,0"),
  /** Resumen semanal (domingo 19:00) y mensual (día 1). */
  summaries: boolean("summaries").notNull().default(true),
  /** "¿Gastaste algo hoy?" tras 2 días sin registros (apagado por defecto). */
  logReminder: boolean("log_reminder").notNull().default(false),
  quietStart: integer("quiet_start").notNull().default(22),
  quietEnd: integer("quiet_end").notNull().default(8),
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
    /** Pago de un servicio o suscripción recurrente. */
    billId: text("bill_id").references(() => recurringBill.id, { onDelete: "set null" }),
    merchant: text("merchant"),
    note: text("note"),
    origin: text("origin").$type<"web" | "telegram" | "import">().notNull().default("web"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("txn_user_date_idx").on(t.userId, t.date), index("txn_line_idx").on(t.creditLineId, t.date)],
);

/** Aprendizaje y reglas de autocategorización por comercio (RN-19). */
export const categoryRule = pgTable(
  "category_rule",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    /** Texto normalizado (minúsculas, sin acentos) que debe contener el comercio. */
    pattern: text("pattern").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    origin: text("origin").$type<"manual" | "learned">().notNull().default("manual"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("category_rule_user_pattern_uq").on(t.userId, t.pattern)],
);

/** Token de un solo uso para vincular Telegram (válido 15 min). */
export const telegramLinkToken = pgTable("telegram_link_token", {
  token: text("token").primaryKey(),
  userId: owner(),
  expiresAt: ts("expires_at").notNull(),
});

/** Avisos enviados o por enviar. La clave única evita duplicados (RNF-10). */
export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    key: text("key").notNull(),
    kind: text("kind").notNull(),
    channel: text("channel").$type<"telegram">().notNull().default("telegram"),
    /** Leída en la bandeja de la app. */
    readAt: ts("read_at"),
    body: text("body").notNull(),
    sentAt: ts("sent_at"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notification_key_uq").on(t.key)],
);

// ── Metas (Fase 2, PRD 7.5) ───────────────────────────────────────────────────

/** Meta de ahorro o fondo de emergencia. Lo ahorrado es la suma de sus movimientos. */
export const goal = pgTable(
  "goal",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    kind: text("kind").$type<"goal" | "emergency" | "sinking">().notNull().default("goal"),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🎯"),
    /** Objetivo fijo. En el fondo de emergencia puede ser null y se calcula (RN-14). */
    targetCents: cents("target_cents"),
    targetDate: day("target_date"),
    /** Meses de gastos esenciales que cubre el fondo de emergencia. */
    emergencyMonths: integer("emergency_months"),
    /** Cuenta real donde vive el dinero; null = apartado virtual (RN-13, RN-25). */
    accountId: text("account_id").references(() => moneyAccount.id, { onDelete: "set null" }),
    /** Aporte automático en cada día de cobro (aparece en Mis quincenas). */
    autoCents: cents("auto_cents"),
    archivedAt: ts("archived_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("goal_user_idx").on(t.userId)],
);

/** Aporte (+) o retiro (−) de una meta. */
export const goalMovement = pgTable(
  "goal_movement",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    amountCents: cents("amount_cents").notNull(),
    date: day("date").notNull(),
    /** Si fue el aporte automático de una quincena, su día de cobro. */
    periodDate: day("period_date"),
    note: text("note"),
    origin: text("origin").$type<"web" | "telegram">().notNull().default("web"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("goal_movement_goal_idx").on(t.goalId)],
);

// ── Me deben (Fase 2, PRD 7.12) ───────────────────────────────────────────────

export const contact = pgTable(
  "contact",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    name: text("name").notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("contact_user_idx").on(t.userId)],
);

/** Dinero prestado o compra hecha a nombre de otra persona. */
export const receivable = pgTable(
  "receivable",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    contactId: text("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"cash" | "purchase" | "paid_for">().notNull(),
    concept: text("concept").notNull(),
    amountCents: cents("amount_cents").notNull(),
    date: day("date").notNull(),
    accountId: text("account_id").references(() => moneyAccount.id, { onDelete: "set null" }),
    creditLineId: text("credit_line_id").references(() => creditLine.id, { onDelete: "set null" }),
    status: text("status").$type<"active" | "settled" | "forgiven">().notNull().default("active"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("receivable_user_idx").on(t.userId)],
);

export const receivablePayment = pgTable(
  "receivable_payment",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    receivableId: text("receivable_id")
      .notNull()
      .references(() => receivable.id, { onDelete: "cascade" }),
    amountCents: cents("amount_cents").notNull(),
    date: day("date").notNull(),
    accountId: text("account_id").references(() => moneyAccount.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("receivable_payment_idx").on(t.receivableId)],
);

// ── Presupuestos y etiquetas (Fase 2, PRD 7.4 y 7.7) ──────────────────────────

/** Tope mensual por categoría (o por clase 50/30/20 si categoryId es null). */
export const budget = pgTable(
  "budget",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    categoryId: text("category_id").references(() => category.id, { onDelete: "cascade" }),
    klass: text("class").$type<"essential" | "lifestyle" | "savings">(),
    monthlyCents: cents("monthly_cents").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("budget_user_idx").on(t.userId)],
);

/** Etiquetas libres que cruzan categorías (#viaje-cancun, #negocio). */
export const tag = pgTable(
  "tag",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    name: text("name").notNull(),
    /** Meta ligada (modo viaje: lo gastado con esta etiqueta sale de la meta). */
    goalId: text("goal_id").references(() => goal.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tag_user_name_uq").on(t.userId, t.name)],
);

export const transactionTag = pgTable(
  "txn_tag",
  {
    transactionId: text("txn_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("txn_tag_uq").on(t.transactionId, t.tagId), index("txn_tag_tag_idx").on(t.tagId)],
);

/** Modo viaje activo por usuario: todo lo que registre el bot lleva esta etiqueta. */
export const travelMode = pgTable("travel_mode", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tag.id, { onDelete: "cascade" }),
  startedAt: ts("started_at").notNull().defaultNow(),
});

// ── Fase 3 (PRD 7.10) ─────────────────────────────────────────────────────────

/** Lista de deseos con enfriamiento de 72 h (RF-37). */
export const wishlistItem = pgTable(
  "wishlist_item",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    product: text("product").notNull(),
    priceCents: cents("price_cents").notNull(),
    months: integer("months").notNull().default(1),
    creditLineId: text("credit_line_id").references(() => creditLine.id, { onDelete: "set null" }),
    note: text("note"),
    availableAt: ts("available_at").notNull(),
    status: text("status").$type<"waiting" | "bought" | "dropped">().notNull().default("waiting"),
    decidedAt: ts("decided_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("wishlist_user_idx").on(t.userId)],
);

/** Servicios (luz, agua, internet) y suscripciones con vencimiento y división (RN-23). */
export const recurringBill = pgTable(
  "recurring_bill",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    kind: text("kind").$type<"service" | "subscription">().notNull(),
    name: text("name").notNull(),
    amountCents: cents("amount_cents").notNull(),
    dayOfMonth: integer("day_of_month").notNull(),
    /** Cada cuántos meses se cobra (1 mensual, 2 bimestral, 12 anual). */
    everyMonths: integer("every_months").notNull().default(1),
    /** Mes (1-12) de referencia para cobros no mensuales. */
    anchorMonth: integer("anchor_month"),
    accountId: text("account_id").references(() => moneyAccount.id, { onDelete: "set null" }),
    creditLineId: text("credit_line_id").references(() => creditLine.id, { onDelete: "set null" }),
    categoryId: text("category_id").references(() => category.id, { onDelete: "set null" }),
    /** Persona con quien se divide; su parte = monto / splitParts. */
    splitContactId: text("split_contact_id").references(() => contact.id, { onDelete: "set null" }),
    splitParts: integer("split_parts").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("recurring_bill_user_idx").on(t.userId)],
);

/** Espacios compartidos (RF-39): gastos en común y quién le debe a quién. */
export const space = pgTable("space", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const spaceMember = pgTable(
  "space_member",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("space_member_uq").on(t.spaceId, t.userId), index("space_member_user_idx").on(t.userId)],
);

export const sharedExpense = pgTable(
  "shared_expense",
  {
    id: text("id").primaryKey(),
    spaceId: text("space_id")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),
    paidBy: text("paid_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** "expense" = gasto en común; "settlement" = pago entre miembros para saldar. */
    kind: text("kind").$type<"expense" | "settlement">().notNull().default("expense"),
    concept: text("concept").notNull(),
    amountCents: cents("amount_cents").notNull(),
    /** Para "settlement": quién recibió el pago. */
    paidTo: text("paid_to").references(() => user.id, { onDelete: "cascade" }),
    date: day("date").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("shared_expense_space_idx").on(t.spaceId)],
);

/** Parte de cada miembro en un gasto compartido. */
export const sharedShare = pgTable(
  "shared_share",
  {
    expenseId: text("expense_id")
      .notNull()
      .references(() => sharedExpense.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    shareCents: cents("share_cents").notNull(),
  },
  (t) => [uniqueIndex("shared_share_uq").on(t.expenseId, t.userId)],
);

/** Meta compartida de un espacio y aportes de cada miembro. */
export const spaceGoal = pgTable("space_goal", {
  id: text("id").primaryKey(),
  spaceId: text("space_id")
    .notNull()
    .references(() => space.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🎯"),
  targetCents: cents("target_cents").notNull(),
  targetDate: day("target_date"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const spaceGoalContribution = pgTable("space_goal_contribution", {
  id: text("id").primaryKey(),
  goalId: text("goal_id")
    .notNull()
    .references(() => spaceGoal.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amountCents: cents("amount_cents").notNull(),
  date: day("date").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Proyectos o negocios (RF-40): ingresos y costos por etiqueta, inversión y clientes. */
export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    name: text("name").notNull(),
    investmentCents: cents("investment_cents").notNull().default(0),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => moneyAccount.id, { onDelete: "set null" }),
    archivedAt: ts("archived_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("project_user_idx").on(t.userId)],
);

export const projectClient = pgTable("project_client", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  monthlyCents: cents("monthly_cents").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ── Fase 4: pendientes del PRD ────────────────────────────────────────────────

/** Suscripción de notificaciones push de un navegador (PWA). */
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("push_subscription_user_idx").on(t.userId)],
);

/** Movimiento dividido en varias categorías (RF-14). La suma = monto del movimiento. */
export const transactionSplit = pgTable(
  "txn_split",
  {
    id: text("id").primaryKey(),
    transactionId: text("txn_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => category.id, { onDelete: "set null" }),
    amountCents: cents("amount_cents").notNull(),
  },
  (t) => [index("txn_split_txn_idx").on(t.transactionId)],
);

/** Cierre de quincena: el saldo real se concilió contra el calculado (PRD 7.10). */
export const quincenaClose = pgTable(
  "quincena_close",
  {
    id: text("id").primaryKey(),
    userId: owner(),
    payday: day("payday").notNull(),
    expectedCents: cents("expected_cents").notNull(),
    actualCents: cents("actual_cents").notNull(),
    closedAt: ts("closed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("quincena_close_uq").on(t.userId, t.payday)],
);

export type WishlistItem = typeof wishlistItem.$inferSelect;
export type RecurringBill = typeof recurringBill.$inferSelect;
export type Space = typeof space.$inferSelect;
export type Project = typeof project.$inferSelect;
export type User = typeof user.$inferSelect;
export type Invitation = typeof invitation.$inferSelect;
export type Budget = typeof budget.$inferSelect;
export type Tag = typeof tag.$inferSelect;
export type Goal = typeof goal.$inferSelect;
export type GoalMovement = typeof goalMovement.$inferSelect;
export type Contact = typeof contact.$inferSelect;
export type Receivable = typeof receivable.$inferSelect;
export type ReceivablePayment = typeof receivablePayment.$inferSelect;
export type MoneyAccount = typeof moneyAccount.$inferSelect;
export type CreditLine = typeof creditLine.$inferSelect;
export type CycleRow = typeof cycle.$inferSelect;
export type InstallmentRow = typeof installment.$inferSelect;
export type IncomeSource = typeof incomeSource.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Txn = typeof transaction.$inferSelect;
