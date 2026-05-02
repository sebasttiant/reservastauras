import { loginAction } from "@/app/actions";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Admin · Reservas Tauras" };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main>
      <section className="card grid" style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1>Ingresar al admin</h1>
        {params.error ? <p className="notice error">{params.error}</p> : null}
        <form action={loginAction} className="grid">
          <label>Email<input name="email" type="email" required /></label>
          <label>Contraseña<input name="password" type="password" required minLength={8} /></label>
          <button type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}
