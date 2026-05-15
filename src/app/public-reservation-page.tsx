import { createReservationAction } from "@/app/actions";
import { LocationSelector, type PublicLocation } from "@/app/location-selector";
import { PartySizeField } from "@/app/party-size-field";
import { ReservationSuccessReset } from "@/app/reservation-success-reset";
import {
  buildPublicLanguageHref,
  getPublicReservationCopy,
  shouldRenderLanguageParam,
} from "@/lib/i18n/public-reservation-dictionary";
import { parsePublicLanguage } from "@/lib/i18n/language";
import { PUBLIC_ERROR_MESSAGES, lookupPublicMessage } from "@/lib/messages";
import { getActiveReservationLocations } from "@/lib/reservations/locations";

const RESERVATION_TIMES = [
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "23:00",
  "00:00", "01:00",
] as const;

interface PublicReservationPageProps {
  searchParams: Record<string, string | undefined>;
}

function toPublicLocations(rows: Awaited<ReturnType<typeof getActiveReservationLocations>>): readonly PublicLocation[] {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.reservationLabel,
    logoSrc: row.logoPath ?? undefined,
    previewSrc: row.heroImagePath ?? undefined,
  }));
}

export async function PublicReservationPage({ searchParams }: PublicReservationPageProps) {
  const publicLanguage = parsePublicLanguage(searchParams.lang);
  const copy = getPublicReservationCopy(publicLanguage);
  const errorMessage = lookupPublicMessage(PUBLIC_ERROR_MESSAGES, searchParams.error, publicLanguage);
  const activeLocations = await getActiveReservationLocations();
  const publicLocations = toPublicLocations(activeLocations);

  return (
    <>
      <main className="hero">
        <div className="hero-shell">
          <section className="hero-copy">
            <p className="brand-kicker">{copy.brandKicker}</p>
            <h1>{copy.hero.title}</h1>
            <p>{copy.hero.description}</p>
            <div className="hero-highlights" aria-label={copy.hero.highlightsAriaLabel}>
              {copy.hero.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}
            </div>
          </section>

          <section className="card reservation-card grid" aria-label={copy.section.ariaLabel}>
            <div className="section-heading">
              <p className="brand-kicker">{copy.section.kicker}</p>
              <h2>{copy.section.title}</h2>
              <p className="muted">{copy.section.description}</p>
            </div>

            <nav className="hero-highlights" aria-label={copy.language.ariaLabel}>
              <a href={buildPublicLanguageHref("en")}>{copy.language.en}</a>
              <a href={buildPublicLanguageHref("es")}>{copy.language.es}</a>
            </nav>

            {searchParams.created ? (
              <>
                <ReservationSuccessReset />
                <p className="notice">{copy.messages.created}</p>
              </>
            ) : null}
            {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

            {publicLocations.length === 0 ? (
              <p className="notice error">{copy.messages.unavailable}</p>
            ) : (
            <form action={createReservationAction} className="grid">
              <input type="hidden" name="customerLanguage" value={publicLanguage} />
              {shouldRenderLanguageParam(publicLanguage) ? <input type="hidden" name="lang" value={publicLanguage} /> : null}
              <LocationSelector
                copy={copy.locations}
                locations={publicLocations}
                isDemo={false}
              />
              <div className="grid two">
                <label className="area-field" data-depends-on="location">
                  <span className="label-row">
                    {copy.form.area}
                    <span className="area-field-hint">{copy.locations.areaHint}</span>
                  </span>
                  <select name="area" defaultValue="Cualquier Mesa Disponible">
                    {copy.areaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <PartySizeField
                  label={copy.form.partySize}
                  alertCopy={copy.form.partySizeHelp}
                  defaultValue={1}
                />
                <label>{copy.form.date}<input name="reservationDate" type="date" required /></label>
                <label>{copy.form.time}
                  <select name="reservationTime" required defaultValue="">
                    <option value="" disabled>{copy.form.timePlaceholder}</option>
                    {RESERVATION_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </label>
                <label>{copy.form.reason}
                  <select name="reason" defaultValue="Ocasional" required>
                    {copy.reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>{copy.form.name}<input name="name" required minLength={2} placeholder={copy.form.namePlaceholder} /></label>
                <label>{copy.form.email}<input name="email" type="email" required placeholder={copy.form.emailPlaceholder} /></label>
                <label>{copy.form.country}
                  <select name="country" defaultValue="Colombia (+57)" required>
                    {copy.countries.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
                  </select>
                </label>
                <label>{copy.form.phone}<input name="phone" inputMode="tel" pattern="[0-9+()\s-]{7,25}" required placeholder={copy.form.phonePlaceholder} title={copy.form.phoneTitle} /></label>
              </div>
              <label>{copy.form.notes}
                <textarea name="notes" rows={4} maxLength={500} placeholder={copy.form.notesPlaceholder} />
              </label>
              <div className="consent-grid">
                <label className="check-row"><input type="checkbox" name="isAdult" required /> {copy.form.isAdult}</label>
                <label className="check-row"><input type="checkbox" name="dataConsent" required /> {copy.form.dataConsent}</label>
              </div>
              <button type="submit">{copy.form.submit}</button>
              <p className="form-note">{copy.form.note}</p>
            </form>
            )}
          </section>
        </div>
      </main>
      <footer className="footer">&copy; 2026 Tauras</footer>
    </>
  );
}
