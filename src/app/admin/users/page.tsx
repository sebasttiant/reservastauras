import { ADMIN_ROLE } from "@/lib/constants";
import { createAdminAction, toggleAdminActiveAction } from "@/app/actions";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { ADMIN_USERS_ERROR_MESSAGES, lookupMessage } from "@/lib/messages";

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const SUCCESS_MESSAGES: Record<string, string> = {
  "admin-created": "Admin creado correctamente.",
  "admin-disabled": "Admin desactivado correctamente.",
  "admin-enabled": "Admin activado correctamente.",
};

export const metadata = { title: "Usuarios admin · Reservas Tauras" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const currentAdmin = await requireSuperAdmin();
  const params = await searchParams;
  const admins = await prisma.admin.findMany({ orderBy: [{ role: "desc" }, { createdAt: "asc" }] });
  const successMessage = params.ok ? SUCCESS_MESSAGES[params.ok] : undefined;
  const errorMessage = lookupMessage(ADMIN_USERS_ERROR_MESSAGES, params.error);

  return (
    <main className="admin-shell">
      <a className="back-link" href="/admin">← Volver al panel</a>
      <header className="admin-header">
        <div className="admin-title">
          <p className="brand-kicker">Super Admin</p>
          <h1>Usuarios</h1>
          <p className="muted">Gestioná quién puede acceder al panel y con qué permisos.</p>
        </div>
      </header>

      {successMessage ? <p className="notice">{successMessage}</p> : null}
      {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

      <section className="card grid">
        <div className="section-heading">
          <p className="brand-kicker">Nuevo acceso</p>
          <h2>Crear admin</h2>
          <p className="muted">Usá ADMIN para operación diaria. Reservá SUPER_ADMIN para configuración crítica.</p>
        </div>
        <form action={createAdminAction} className="grid two">
          <label>Nombre<input name="name" required minLength={2} /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Contraseña inicial<input name="password" type="password" required minLength={10} /></label>
          <label>Rol
            <select name="role" defaultValue={ADMIN_ROLE.ADMIN} required>
              <option value={ADMIN_ROLE.ADMIN}>Admin — reservas</option>
              <option value={ADMIN_ROLE.SUPER_ADMIN}>Super Admin — acceso total</option>
            </select>
          </label>
          <button type="submit">Crear usuario admin</button>
        </form>
      </section>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th><th /></tr></thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.name}</td>
                <td>{admin.email}</td>
                <td><span className="status-pill">{admin.role === ADMIN_ROLE.SUPER_ADMIN ? "Super Admin" : "Admin"}</span></td>
                <td><span className={`status-pill ${admin.isActive ? "status-confirmed" : "status-cancelled"}`}>{admin.isActive ? "Activo" : "Inactivo"}</span></td>
                <td>{admin.createdAt.toISOString().slice(0, 10)}</td>
                <td>
                  {admin.id === currentAdmin.adminId ? <span className="muted">Tu usuario</span> : (
                    <form action={toggleAdminActiveAction}>
                      <input type="hidden" name="adminId" value={admin.id} />
                      <button className="secondary table-button" type="submit">{admin.isActive ? "Desactivar" : "Activar"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
