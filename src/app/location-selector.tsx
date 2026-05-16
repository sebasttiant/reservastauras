"use client";

/* eslint-disable @next/next/no-img-element --
   UI skeleton: usamos <img> plano con loading="lazy" porque todavía no hay
   pipeline de assets ni dominios configurados para next/image. OpenCode
   puede migrar a <Image> al conectar el modelo real de sedes. */
/**
 * Selector de sede del formulario público de reservas.
 *
 * - Debe renderizarse DENTRO del <form> para que el radio emita
 *   `locationSlug` al FormData del server action.
 * - No reemplaza el campo `area` (zona/ambiente); es independiente.
 * - Los datos de sedes llegan por prop desde sedes activas reales.
 */

import { useState, type ReactNode } from "react";

export interface PublicLocation {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoSrc?: string;
  previewSrc?: string;
  previewAlt?: string;
}

interface LocationSelectorCopy {
  kicker: string;
  title: string;
  description: string;
  ariaLabel: string;
  demoBadge: string;
  previewAlt: string;
  previewFallback: string;
}

interface LocationSelectorProps {
  copy: LocationSelectorCopy;
  locations: readonly PublicLocation[];
  isDemo?: boolean;
}

export function LocationSelector({
  copy,
  locations,
  isDemo = false,
}: LocationSelectorProps): ReactNode {
  const [selectedSlug, setSelectedSlug] = useState("");
  const selectedLocation = locations.find((location) => location.slug === selectedSlug);

  return (
    <section className="location-selector" aria-label={copy.ariaLabel}>
      <header className="location-selector-heading">
        <p className="brand-kicker">
          {copy.kicker}
          {isDemo ? <span className="location-demo-badge">{copy.demoBadge}</span> : null}
        </p>
        <h3>{copy.title}</h3>
        <p className="muted">{copy.description}</p>
      </header>

      <div className="location-cards" role="radiogroup" aria-label={copy.ariaLabel}>
        {locations.map((location) => (
          <label key={location.id} className="location-card" data-location-id={location.id}>
            <input
              type="radio"
              name="locationSlug"
              value={location.slug}
              required
              className="location-card-input"
              aria-label={location.name}
              onChange={() => setSelectedSlug(location.slug)}
            />
            <span className="location-card-logo" aria-hidden="true">
              {location.logoSrc ? (
                <img src={location.logoSrc} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="location-card-logo-fallback">
                  {location.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <span className="location-card-body">
              <span className="location-card-name">{location.name}</span>
              <span className="location-card-description">{location.description}</span>
            </span>
          </label>
        ))}
      </div>

      <figure className="location-preview" aria-live="polite">
        {selectedLocation?.previewSrc ? (
          <img
            src={selectedLocation.previewSrc}
            alt={selectedLocation.previewAlt ?? copy.previewAlt}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <figcaption className="location-preview-fallback">
            {copy.previewFallback}
          </figcaption>
        )}
      </figure>
    </section>
  );
}
