import { createReservationAction } from "@/app/actions";
import { LocationSelector, type PublicLocation } from "@/app/location-selector";
import { PartySizeField } from "@/app/party-size-field";
import { ReservationDynamicFields } from "@/app/reservation-dynamic-fields";
import { ReservationSuccessReset } from "@/app/reservation-success-reset";
import {
  buildPublicLanguageHref,
  getPublicReservationCopy,
  getLocationAreaOptions,
  shouldRenderLanguageParam,
} from "@/lib/i18n/public-reservation-dictionary";
import { parsePublicLanguage } from "@/lib/i18n/language";
import {
  LOCATION_SLUGS,
  getLocationTimeOptions,
} from "@/lib/reservations/location-config";
import type { PublicLanguage } from "@/lib/i18n/language";
import { PUBLIC_ERROR_MESSAGES, lookupPublicMessage } from "@/lib/messages";
import { getActiveReservationLocations } from "@/lib/reservations/locations";
import type { PublicReservationCopy } from "@/lib/i18n/public-reservation-dictionary";

interface PublicReservationPageProps {
  searchParams: Record<string, string | undefined>;
}

interface AreaOption {
  value: string;
  label: string;
}

function toPublicLocations(
  rows: Awaited<ReturnType<typeof getActiveReservationLocations>>,
  locationEntries: PublicReservationCopy["locationEntries"],
): readonly PublicLocation[] {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: locationEntries[row.slug]
      ? `${locationEntries[row.slug].description} · ${locationEntries[row.slug].hours}`
      : row.reservationLabel,
    logoSrc: row.logoPath ?? undefined,
    previewSrc: row.heroImagePath ?? undefined,
  }));
}

function buildAreaOptionsByLocation(language: PublicLanguage): Record<string, readonly AreaOption[]> {
  const result: Record<string, readonly AreaOption[]> = {};
  for (const slug of Object.values(LOCATION_SLUGS)) {
    result[slug] = getLocationAreaOptions(slug, language);
  }
  return result;
}

function buildTimeOptionsByLocation(): Record<string, readonly string[]> {
  const result: Record<string, readonly string[]> = {};
  for (const slug of Object.values(LOCATION_SLUGS)) {
    result[slug] = getLocationTimeOptions(slug);
  }
  return result;
}

export async function PublicReservationPage({ searchParams }: PublicReservationPageProps) {
  const publicLanguage = parsePublicLanguage(searchParams.lang);
  const copy = getPublicReservationCopy(publicLanguage);
  const errorMessage = lookupPublicMessage(PUBLIC_ERROR_MESSAGES, searchParams.error, publicLanguage);
  const activeLocations = await getActiveReservationLocations();
  const publicLocations = toPublicLocations(activeLocations, copy.locationEntries);

  const areaOptionsByLocation = buildAreaOptionsByLocation(publicLanguage);
  const timeOptionsByLocation = buildTimeOptionsByLocation();
  const defaultLocationSlug = publicLocations.length > 0 ? publicLocations[0].slug : "tauras-default";

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
                <ReservationDynamicFields
                  areaOptionsByLocation={areaOptionsByLocation}
                  timeOptionsByLocation={timeOptionsByLocation}
                  defaultLocationSlug={defaultLocationSlug}
                  areaLabel={copy.form.area}
                  areaHint={copy.locations.areaHint}
                  timeLabel={copy.form.time}
                  timePlaceholder={copy.form.timePlaceholder}
                />
                <PartySizeField
                  label={copy.form.partySize}
                  alertCopy={copy.form.partySizeHelp}
                  defaultValue={1}
                />
                <label>{copy.form.date}<input name="reservationDate" type="date" required /></label>
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
