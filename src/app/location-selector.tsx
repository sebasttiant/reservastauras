"use client";

/* eslint-disable @next/next/no-img-element --
   El logo de la sede viene del modelo actual como ruta pública simple. No es
   contenido principal ni preview de zona; cuando tengamos pipeline de assets,
   puede migrarse a next/image junto con las fotos reales de ambientes. */

import type { ReactNode } from "react";

export interface PublicLocation {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoSrc?: string;
}

interface LocationSelectorCopy {
  title: string;
  ariaLabel: string;
  demoBadge: string;
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
  return (
    <section className="location-selector" aria-label={copy.ariaLabel}>
      <header className="location-selector-heading">
        <h3>{copy.title}</h3>
        {isDemo ? <span className="location-demo-badge">{copy.demoBadge}</span> : null}
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
    </section>
  );
}
