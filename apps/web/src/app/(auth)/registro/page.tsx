import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { GlassCard } from "@/components/ui/glass-card";
import { findValidInvitation, isFirstUser } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { signUpAction } from "../actions";

export const metadata: Metadata = { title: "Crear cuenta" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ invitacion?: string }> };

export default async function SignUpPage({ searchParams }: Props) {
  if (await getSession()) redirect("/app");

  const { invitacion: token = "" } = await searchParams;
  const firstRun = await isFirstUser();
  const invite = !firstRun && token ? await findValidInvitation(token) : null;

  if (!firstRun && !invite) {
    return (
      <>
        <section className="min-w-0">
          <p className="eyebrow rise">Registro por invitación</p>
          <h1 className="rise d1 mt-5 text-[clamp(2.6rem,6.5vw,4.8rem)] font-semibold leading-[0.95] tracking-tighter chrome">
            Este enlace ya no abre la puerta.
          </h1>
        </section>
        <GlassCard interactive={false} className="rise d2 p-7 md:p-9">
          <h2 className="text-xl font-semibold tracking-tight">
            {token ? "La invitación se usó o venció" : "Necesitas una invitación"}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mist">
            Las invitaciones son de un solo uso y duran 7 días. Pídele un enlace nuevo a quien administra el
            servidor.
          </p>
          <Link href="/entrar" className="btn btn-ghost mt-7 w-full rounded-xl py-3.5 text-[15px]">
            Ya tengo cuenta
          </Link>
        </GlassCard>
      </>
    );
  }

  return (
    <>
      <section className="min-w-0">
        <p className="eyebrow rise">{firstRun ? "Primer arranque" : "Te invitaron"}</p>
        <h1 className="rise d1 mt-5 text-[clamp(2.8rem,7vw,5.2rem)] font-semibold leading-[0.95] tracking-tighter">
          <span className="chrome">{firstRun ? "Este servidor" : "Empieza"}</span>
          <br />
          <span className="chrome-soft">{firstRun ? "es tuyo." : "esta quincena."}</span>
        </h1>
        <p className="rise d2 mt-6 max-w-md text-lg leading-relaxed text-mist">
          {firstRun
            ? "La primera cuenta es la del administrador. Desde ella invitarás a tu familia."
            : "Tus datos son solo tuyos. Nadie más en el servidor puede verlos, ni siquiera quien te invitó."}
        </p>
      </section>

      <AuthForm
        title={firstRun ? "Cuenta de administrador" : "Crea tu cuenta"}
        subtitle={invite?.note ? `Nota: ${invite.note}` : undefined}
        fields={[
          { name: "name", label: "Nombre", type: "text", autoComplete: "name", placeholder: "¿Cómo te llamas?" },
          {
            name: "email",
            label: "Correo",
            type: "email",
            autoComplete: "email",
            placeholder: "tu@correo.com",
            defaultValue: invite?.email ?? undefined,
            readOnly: Boolean(invite?.email),
          },
          {
            name: "password",
            label: "Contraseña",
            type: "password",
            autoComplete: "new-password",
            placeholder: "Mínimo 8 caracteres",
            hint: "Usa una frase que no uses en otro lado.",
          },
        ]}
        hidden={token ? { token } : undefined}
        submitLabel="Crear cuenta"
        pendingLabel="Creando tu cuenta"
        action={signUpAction}
        footer={
          <Link href="/entrar" className="underline-offset-4 hover:text-ink hover:underline">
            Ya tengo cuenta
          </Link>
        }
      />
    </>
  );
}
