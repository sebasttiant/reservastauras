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

interface ZonePhotoView {
  id: string;
  areaValue: string;
  imagePath: string | null;
}

export const metadata = { title: "Fotos de zonas · Reservas Tauras" };
export const dynamic = "force-dynamic";

export default async function AdminPhotosPage({ searchParams }: PhotosPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const successMessage = params.ok ? lookupMessage(PHOTO_SUCCESS_MESSAGES, params.ok) : null;
  const errorMessage = lookupMessage(PHOTO_ERROR_MESSAGES, params.error);

  const locations = await getActiveReservationLocations();

  const locationsWithZones = await Promise.all(
    locations.map(async (loc) => {
      const zones = await prisma.zone.findMany({
        where: { locationId: loc.id },
        select: { id: true, areaValue: true, imagePath: true },
        orderBy: { createdAt: "asc" },
      });
      const zonesByArea = new Map(zones.map((zone) => [zone.areaValue, zone]));
      const canonicalAreas = LOCATION_AREA_VALUES[loc.slug] ?? [];
      const canonicalZones: ZonePhotoView[] = canonicalAreas.map((areaValue) => {
        const existing = zonesByArea.get(areaValue);
        return {
          id: existing?.id ?? `${loc.id}:${areaValue}`,
          areaValue,
          imagePath: existing?.imagePath ?? null,
        };
      });
      const customZones = zones.filter((zone) => !canonicalAreas.includes(zone.areaValue));

      return { ...loc, zones: [...canonicalZones, ...customZones] };
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
                  <form action={uploadZonePhotoAction} encType="multipart/form-data">
                    <input type="hidden" name="locationId" value={location.id} />
                    <input type="hidden" name="areaValue" value={zone.areaValue} />
                    <input type="file" name="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" required />
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
