import { changePasswordAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { CHANGE_PASSWORD_ERROR_MESSAGES, CHANGE_PASSWORD_SUCCESS_MESSAGES, lookupMessage } from "@/lib/messages";

interface ChangePasswordPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Cambiar contraseña · Reservas Tauras" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const successMessage = lookupMessage(CHANGE_PASSWORD_SUCCESS_MESSAGES, params.ok);
  const errorMessage = lookupMessage(CHANGE_PASSWORD_ERROR_MESSAGES, params.error);

  return (
    <main className="admin-shell">
      <a className="back-link" href="/admin">← Volver al panel</a>
      <header className="admin-header">
        <div className="admin-title">
          <p className="brand-kicker">Mi cuenta</p>
          <h1>Cambiar contraseña</h1>
          <p className="muted">Actualizá tu contraseña de acceso al panel.</p>
        </div>
      </header>

      {successMessage ? <p className="notice">{successMessage}</p> : null}
      {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

      <section className="card grid">
        <form action={changePasswordAction} className="grid">
          <label>
            Contraseña actual
            <input name="currentPassword" type="password" autoComplete="current-password" required minLength={1} />
          </label>
          <label>
            Nueva contraseña
            <input name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
          </label>
          <label>
            Confirmar nueva contraseña
            <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} />
          </label>
          <button type="submit">Actualizar contraseña</button>
        </form>
      </section>
    </main>
  );
}
