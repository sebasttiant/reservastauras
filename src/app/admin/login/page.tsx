import { loginAction } from "@/app/actions";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Admin · Reservas Tauras" };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="hero">
      <section className="card login-card grid">
        <div className="section-heading">
          <p className="brand-kicker">Tauras Admin</p>
          <h1>Ingreso interno</h1>
          <p className="muted">Accedé al panel para revisar solicitudes, cuidar los cupos y acompañar cada confirmación.</p>
        </div>
        {params.error ? <p className="notice error">{params.error}</p> : null}
        <form action={loginAction} className="grid">
          <label>Email<input name="email" type="email" required placeholder="admin@tauras.com" /></label>
          <label>Contraseña<input name="password" type="password" required minLength={8} placeholder="Tu contraseña segura" /></label>
          <button type="submit">Entrar al dashboard</button>
        </form>
      </section>
    </main>
  );
}
