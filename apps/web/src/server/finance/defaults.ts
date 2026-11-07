import { randomUUID } from "node:crypto";
import { category, db } from "@gp/db";
import { count, eq } from "drizzle-orm";

type Seed = { name: string; emoji: string; klass: "essential" | "lifestyle" | "savings"; isAnt?: boolean };

// Catálogo inicial para México (PRD 7.4). Cada usuario lo puede editar.
const EXPENSES: Seed[] = [
  { name: "Súper y despensa", emoji: "🛒", klass: "essential" },
  { name: "Restaurantes", emoji: "🍽️", klass: "lifestyle" },
  { name: "Café y antojos", emoji: "☕", klass: "lifestyle", isAnt: true },
  { name: "Gasolina", emoji: "⛽", klass: "essential" },
  { name: "Uber y Didi", emoji: "🚕", klass: "lifestyle", isAnt: true },
  { name: "Carro", emoji: "🚗", klass: "essential" },
  { name: "Hogar y servicios", emoji: "🏠", klass: "essential" },
  { name: "Internet y telefonía", emoji: "📶", klass: "essential" },
  { name: "Salud y farmacia", emoji: "💊", klass: "essential" },
  { name: "Gym y deporte", emoji: "🏋️", klass: "lifestyle" },
  { name: "Suscripciones", emoji: "📺", klass: "lifestyle" },
  { name: "Ropa", emoji: "👕", klass: "lifestyle" },
  { name: "Entretenimiento", emoji: "🎟️", klass: "lifestyle" },
  { name: "Educación", emoji: "📚", klass: "essential" },
  { name: "Regalos", emoji: "🎁", klass: "lifestyle" },
  { name: "Mascotas", emoji: "🐾", klass: "essential" },
  { name: "Tecnología", emoji: "💻", klass: "lifestyle" },
  { name: "Préstamos a terceros", emoji: "🤝", klass: "lifestyle" },
  { name: "Comisiones e intereses", emoji: "🏦", klass: "essential" },
  { name: "Otros", emoji: "•", klass: "lifestyle" },
];

const INCOMES: Seed[] = [
  { name: "Sueldo", emoji: "💼", klass: "essential" },
  { name: "Horas extra", emoji: "⏱️", klass: "essential" },
  { name: "Negocio", emoji: "📡", klass: "essential" },
  { name: "Aguinaldo y bonos", emoji: "🎄", klass: "essential" },
  { name: "Ventas", emoji: "🏷️", klass: "essential" },
  { name: "Reembolsos", emoji: "↩️", klass: "essential" },
  { name: "Otros ingresos", emoji: "•", klass: "essential" },
];

/** Crea las categorías por defecto la primera vez que el usuario entra. */
export async function ensureDefaultCategories(userId: string) {
  const [row] = await db.select({ n: count() }).from(category).where(eq(category.userId, userId));
  if ((row?.n ?? 0) > 0) return;
  const rows = [
    ...EXPENSES.map((s, i) => ({ ...s, kind: "expense" as const, sortOrder: i })),
    ...INCOMES.map((s, i) => ({ ...s, kind: "income" as const, sortOrder: i })),
  ].map((s) => ({
    id: randomUUID(),
    userId,
    name: s.name,
    emoji: s.emoji,
    kind: s.kind,
    klass: s.klass,
    isAnt: s.isAnt ?? false,
    sortOrder: s.sortOrder,
  }));
  await db.insert(category).values(rows).onConflictDoNothing();
}
