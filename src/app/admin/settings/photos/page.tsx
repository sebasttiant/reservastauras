import {
  uploadZonePhotoAction,
  deleteZonePhotoAction,
} from "@/app/actions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PHOTO_SUCCESS_MESSAGES, PHOTO_ERROR_MESSAGES, lookupMessage } from "@/lib/messages";
import { LOCATION_AREA_VALUES } from "@/lib/reservations/location-config";
import { getActiveReservationLocations } from "@/lib/reservations/locations";

/* eslint-disable @next/next/no-img-element --
   Las fotos son archivos subidos por admins y servidos desde /uploads.
   Para este MVP evitamos next/image hasta definir una política final de
   optimización/caché para archivos persistidos en volumen Docker. */

interface PhotosPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Fotos de zonas · Reservas Tauras" };
export const dynamic = "force-dynamic";

async function ensureZoneRows(locationId: string, slug: string): Promise<void> {
  // Side effect intencional: mantiene la tabla Zone sincronizada con la config
  // canónica de áreas sin pisar imagePath ni requerir una pantalla separada de
  // administración de zonas.
  const areas = LOCATION_AREA_VALUES[slug];
  if (!areas) return;

  const existing = await prisma.zone.findMany({
    where: { locationId },
    select: { areaValue: true },
  });
  const existingSet = new Set(existing.map((z) => z.areaValue));

  const missing = areas.filter((a) => !existingSet.has(a));
  if (missing.length === 0) return;

  await Promise.all(
    missing.map((areaValue) =>
      prisma.zone.upsert({
        where: { locationId_areaValue: { locationId, areaValue } },
        update: {},
        create: { locationId, areaValue },
      }),
    ),
  );
}

export default async function AdminPhotosPage({ searchParams }: PhotosPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const successMessage = params.ok ? lookupMessage(PHOTO_SUCCESS_MESSAGES, params.ok) : null;
  const errorMessage = lookupMessage(PHOTO_ERROR_MESSAGES, params.error);

  const locations = await getActiveReservationLocations();

  const locationsWithZones = await Promise.all(
    locations.map(async (loc) => {
      await ensureZoneRows(loc.id, loc.slug);
      const zones = await prisma.zone.findMany({
        where: { locationId: loc.id },
        select: { id: true, areaValue: true, imagePath: true },
        orderBy: { createdAt: "asc" },
      });
      return { ...loc, zones };
    }),
  );

  return (
    <main className="admin-shell">
      <a className="back-link" href="/admin">← Volver al panel</a>
      <header className="admin-header">
        <div className="admin-title">
          <p className="brand-kicker">Super Admin</p>
          <h1>Fotos de zonas</h1>
          <p className="muted">Subí o reemplazá las fotos de cada ambiente para que los clientes las vean al reservar.</p>
        </div>
      </header>

      {successMessage ? <p className="notice">{successMessage}</p> : null}
      {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

      {locationsWithZones.map((location) => (
        <section key={location.id} className="card grid">
          <div className="section-heading">
            <p className="brand-kicker">{location.name}</p>
            <h2>Zonas</h2>
          </div>
          <div className="zone-list">
            {location.zones.map((zone) => (
              <article key={zone.id} className="zone-card">
                {zone.imagePath ? (
                  <img
                    src={zone.imagePath}
                    alt={zone.areaValue}
                    className="zone-photo-thumb"
                    loading="lazy"
                  />
                ) : (
                  <div className="zone-card-placeholder">
                    <span className="zone-preview-name">{zone.areaValue}</span>
                    <span className="muted">Sin foto</span>
                  </div>
                )}
                <div className="zone-card-actions">
                  <span className="zone-preview-name">{zone.areaValue}</span>
                  <form action={uploadZonePhotoAction}>
                    <input type="hidden" name="locationId" value={location.id} />
                    <input type="hidden" name="areaValue" value={zone.areaValue} />
                    <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
                    <button type="submit">{zone.imagePath ? "Reemplazar" : "Subir foto"}</button>
                  </form>
                  {zone.imagePath ? (
                    <form action={deleteZonePhotoAction}>
                      <input type="hidden" name="zoneId" value={zone.id} />
                      <button className="secondary" type="submit">Eliminar foto</button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
