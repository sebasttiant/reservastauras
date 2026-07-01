import { ADMIN_ROLE_LABELS } from "@/lib/constants";
import { updateOwnAccountAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { ACCOUNT_ERROR_MESSAGES, ACCOUNT_SUCCESS_MESSAGES, lookupMessage } from "@/lib/messages";

interface AccountPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Mi cuenta · Reservas Tauras" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: AccountPageProps) {
  // requireAdmin admits every administrator role, so the RESERVATION_OPERATOR —
  // which has no other administration surface — can manage its own account here.
  const admin = await requireAdmin();
  const params = await searchParams;
  const successMessage = lookupMessage(ACCOUNT_SUCCESS_MESSAGES, params.ok);
  const errorMessage = lookupMessage(ACCOUNT_ERROR_MESSAGES, params.error);

  return (
    <main className="admin-shell">
      <a className="back-link" href="/admin">← Volver al panel</a>
      <header className="admin-header">
        <div className="admin-title">
          <p className="brand-kicker">Mi cuenta</p>
          <h1>Tu perfil</h1>
          <p className="muted">Actualizá tu nombre, email y, si querés, tu contraseña. Tu rol ({ADMIN_ROLE_LABELS[admin.role]}) solo lo puede cambiar un Super Admin.</p>
        </div>
      </header>

      {successMessage ? <p className="notice">{successMessage}</p> : null}
      {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

      <section className="card grid">
        <form action={updateOwnAccountAction} className="grid">
          <label>Nombre<input name="name" defaultValue={admin.name} required minLength={2} /></label>
          <label>Email<input name="email" type="email" defaultValue={admin.email} required /></label>

          <div className="section-heading">
            <h2>Cambiar contraseña</h2>
            <p className="muted">Opcional. Dejá estos campos vacíos para mantener tu contraseña actual.</p>
          </div>
          <label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" minLength={1} /></label>
          <label>Nueva contraseña<input name="newPassword" type="password" autoComplete="new-password" minLength={10} placeholder="Mínimo 10 caracteres" /></label>
          <label>Confirmar nueva contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} /></label>

          <button type="submit">Guardar cambios</button>
        </form>
      </section>
    </main>
  );
}
