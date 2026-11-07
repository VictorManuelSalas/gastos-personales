import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { account, db, invitation, session, user, verification } from "@gp/db";
import { and, count, eq, gt, isNull } from "drizzle-orm";

export const INVITE_HEADER = "x-invite-token";

async function countUsers() {
  const [row] = await db.select({ n: count() }).from(user);
  return row?.n ?? 0;
}

/** Invitación vigente: existe, no se ha usado y no ha vencido. */
export async function findValidInvitation(token: string) {
  const [row] = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.token, token),
        isNull(invitation.usedAt),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function isFirstUser() {
  return (await countUsers()) === 0;
}

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";

export const auth = betterAuth({
  appName: "Quincena",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl, "http://localhost:3100", "http://127.0.0.1:3100"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 días
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  databaseHooks: {
    user: {
      create: {
        // El primer usuario del servidor es el administrador.
        before: async (data) => ({
          data: { ...data, role: (await isFirstUser()) ? "admin" : "user" },
        }),
      },
    },
  },
  hooks: {
    // Registro cerrado: solo con invitación vigente (o si aún no existe ningún usuario).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      if (await isFirstUser()) return;

      const token = ctx.headers?.get(INVITE_HEADER);
      if (!token) {
        throw new APIError("FORBIDDEN", { message: "Necesitas una invitación para crear tu cuenta." });
      }
      const inv = await findValidInvitation(token);
      if (!inv) {
        throw new APIError("FORBIDDEN", { message: "Esta invitación ya se usó o venció. Pide una nueva." });
      }
      const email = String((ctx.body as { email?: string } | undefined)?.email ?? "").toLowerCase();
      if (inv.email && inv.email.toLowerCase() !== email) {
        throw new APIError("FORBIDDEN", { message: `Esta invitación es para ${inv.email}.` });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const token = ctx.headers?.get(INVITE_HEADER);
      const newUser = ctx.context.newSession?.user;
      if (!token || !newUser) return;
      await db
        .update(invitation)
        .set({ usedBy: newUser.id, usedAt: new Date() })
        .where(and(eq(invitation.token, token), isNull(invitation.usedAt)));
    }),
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
