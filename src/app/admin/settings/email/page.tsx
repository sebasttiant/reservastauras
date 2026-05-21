import { getEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Correo · Reservas Tauras" };
export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  await requireAdmin();
  const env = getEnv();
  const smtpConfigured = Boolean(env.SMTP_HOST);

  return (
    <main className="admin-shell">
      <a className="back-link" href="/admin">← Volver al panel</a>
      <section className="card grid">
        <div className="section-heading">
          <p className="brand-kicker">Super Admin</p>
          <h1>Correo de confirmación</h1>
          <p className="muted">Configuración actual de envío. La contraseña nunca se muestra en pantalla.</p>
        </div>

        <p className={smtpConfigured ? "notice" : "notice error"}>
          {smtpConfigured ? "SMTP configurado para enviar confirmaciones." : "SMTP no configurado: las reservas se confirman, pero el envío registrará emailError."}
        </p>

        <dl className="grid two">
          <div><dt>SMTP host</dt><dd>{env.SMTP_HOST || "Sin configurar"}</dd></div>
          <div><dt>Puerto</dt><dd>{env.SMTP_PORT}</dd></div>
          <div><dt>Usuario</dt><dd>{env.SMTP_USER || "Sin configurar"}</dd></div>
          <div><dt>Remitente</dt><dd>{env.SMTP_FROM}</dd></div>
          <div><dt>Password</dt><dd>{env.SMTP_PASSWORD ? "•••••••• configurada" : "Sin configurar"}</dd></div>
        </dl>

        <div className="notice">
          <strong>Modo seguro:</strong> por ahora estos valores se administran por variables de entorno/Docker.
          Para edición desde UI hace falta cifrar secretos antes de guardarlos en base de datos.
        </div>
      </section>
    </main>
  );
}
