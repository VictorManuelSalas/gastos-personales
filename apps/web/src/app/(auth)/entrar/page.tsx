import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { isFirstUser } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { signInAction } from "../actions";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getSession()) redirect("/app");
  const firstRun = await isFirstUser();

  return (
    <>
      <section className="min-w-0">
        <p className="eyebrow rise">Bienvenido de vuelta</p>
        <h1 className="rise d1 mt-5 text-[clamp(2.8rem,7vw,5.2rem)] font-semibold leading-[0.95] tracking-tighter">
          <span className="chrome">Tu quincena</span>
          <br />
          <span className="chrome-soft">te espera.</span>
        </h1>
        <p className="rise d2 mt-6 max-w-md text-lg leading-relaxed text-mist">
          Entra para ver lo que entra, lo que se va y lo que de verdad te queda.
        </p>
      </section>

      <AuthForm
        title="Inicia sesión"
        fields={[
          { name: "email", label: "Correo", type: "email", autoComplete: "email", placeholder: "tu@correo.com" },
          { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password", placeholder: "••••••••" },
        ]}
        submitLabel="Entrar"
        pendingLabel="Entrando"
        action={signInAction}
        footer={
          firstRun ? (
            <>
              Aún no hay cuentas en este servidor.{" "}
              <Link href="/registro" className="text-glow underline-offset-4 hover:underline">
                Crea la cuenta de administrador
              </Link>
            </>
          ) : (
            <>¿No tienes cuenta? Pide una invitación a quien administra el servidor.</>
          )
        }
      />
    </>
  );
}
