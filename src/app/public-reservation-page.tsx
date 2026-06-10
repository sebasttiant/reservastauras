import { createReservationAction } from "@/app/actions";
import { LocationSelector, type PublicLocation } from "@/app/location-selector";
import { PartySizeField } from "@/app/party-size-field";
import { ReservationDynamicFields } from "@/app/reservation-dynamic-fields";
import { ReservationSuccessReset } from "@/app/reservation-success-reset";
import { SubmitButton } from "@/app/submit-button";
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
import { getActiveReservationLocations, getZoneImages } from "@/lib/reservations/locations";
import { getBusinessTodayDateString } from "@/lib/reservations/business-date";
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

function formatDate(dateStr: string, language: PublicLanguage): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  if (language === "es") return `${day}/${month}/${year}`;
  return `${month}/${day}/${year}`;
}

function buildSuccessSummary(
  params: Record<string, string | undefined>,
  language: PublicLanguage,
): Record<string, string> | null {
  if (!params.created) return null;
  return {
    date: params.d ? formatDate(params.d, language) : "",
    time: params.t ?? "",
    guests: params.p ?? "",
    area: params.a ?? "",
  };
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
  const minimumReservationDate = getBusinessTodayDateString();

  const zoneImagesByLocation: Record<string, Record<string, string | null>> = {};
  await Promise.all(
    activeLocations.map(async (loc) => {
      zoneImagesByLocation[loc.slug] = await getZoneImages(loc.id);
    }),
  );

  const successSummary = buildSuccessSummary(searchParams, publicLanguage);

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

            <div className="language-switch">
              <p className="language-switch-title">{copy.language.title}</p>
              <nav className="language-options" aria-label={copy.language.ariaLabel}>
                <a
                  href={buildPublicLanguageHref("en")}
                  className="language-option"
                  hrefLang="en"
                  aria-current={publicLanguage === "en" ? "true" : undefined}
                >
                  <img
                    className="language-flag"
                    src="/flags/us.svg"
                    alt=""
                    aria-hidden="true"
                    width={22}
                    height={22}
                  />
                  <span className="language-name">{copy.language.en}</span>
                </a>
                <a
                  href={buildPublicLanguageHref("es")}
                  className="language-option"
                  hrefLang="es"
                  aria-current={publicLanguage === "es" ? "true" : undefined}
                >
                  <img
                    className="language-flag"
                    src="/flags/es.svg"
                    alt=""
                    aria-hidden="true"
                    width={22}
                    height={22}
                  />
                  <span className="language-name">{copy.language.es}</span>
                </a>
              </nav>
            </div>

            {successSummary ? (
              <>
                <ReservationSuccessReset />
                <div className="success-block">
                  <div className="success-icon" aria-hidden="true">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" />
                      <path d="M12 20l6 6 10-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="success-title">{copy.success.title}</h3>
                  <p className="success-message">{copy.messages.created}</p>
                  <dl className="success-summary">
                    <div className="success-summary-row">
                      <dt>{copy.success.date}</dt>
                      <dd>{successSummary.date}</dd>
                    </div>
                    <div className="success-summary-row">
                      <dt>{copy.success.time}</dt>
                      <dd>{successSummary.time}</dd>
                    </div>
                    <div className="success-summary-row">
                      <dt>{copy.success.guests}</dt>
                      <dd>{successSummary.guests}</dd>
                    </div>
                    {successSummary.area && (
                      <div className="success-summary-row">
                        <dt>{copy.success.area}</dt>
                        <dd>{successSummary.area}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </>
            ) : null}
            {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

            {publicLocations.length === 0 ? (
              <p className="notice error">{copy.messages.unavailable}</p>
            ) : (
            <>
              <div className="before-booking">
                <p className="before-booking-title">{copy.beforeBooking.title}</p>
                <ul className="before-booking-list">
                  {copy.beforeBooking.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
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
                  zonePreviewFallback={copy.zonePreviewFallback}
                  zoneImagesByLocation={zoneImagesByLocation}
                />
                <PartySizeField
                  label={copy.form.partySize}
                  alertCopy={copy.form.partySizeHelp}
                  defaultValue={1}
                />
                <label>{copy.form.date}<input name="reservationDate" type="date" min={minimumReservationDate} required /></label>
                <label>{copy.form.reason}
                  <select name="reason" defaultValue="Ocasional" required>
                    {copy.reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="label-row">
                    {copy.form.name}
                    <span className="field-hint-inline">{copy.form.nameHint}</span>
                  </span>
                  <input name="name" autoComplete="name" required minLength={2} placeholder={copy.form.namePlaceholder} />
                </label>
                <label>{copy.form.email}<input name="email" type="email" autoComplete="email" required placeholder={copy.form.emailPlaceholder} /></label>
                <label>{copy.form.country}
                  <select name="country" defaultValue="Colombia (+57)" required>
                    {copy.countries.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="label-row">
                    {copy.form.phone}
                    <span className="field-hint-inline">{copy.form.phoneHint}</span>
                  </span>
                  <input name="phone" type="tel" autoComplete="tel" inputMode="tel" pattern="[0-9+()\s-]{7,25}" required placeholder={copy.form.phonePlaceholder} title={copy.form.phoneTitle} />
                </label>
              </div>
              <label>{copy.form.notes}
                <textarea name="notes" rows={4} maxLength={500} placeholder={copy.form.notesPlaceholder} />
              </label>
              <div className="consent-grid">
                <label className="check-row"><input type="checkbox" name="isAdult" required /> {copy.form.isAdult}</label>
                <label className="check-row"><input type="checkbox" name="dataConsent" required /> {copy.form.dataConsent}</label>
              </div>
              <SubmitButton pendingLabel={copy.form.submitPending}>{copy.form.submit}</SubmitButton>
              <p className="form-note">{copy.form.note}</p>
            </form>
            </>
            )}
          </section>
        </div>
      </main>
      <footer className="footer">&copy; 2026 Tauras</footer>
    </>
  );
}
