"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildAdminFilterHref } from "./admin-reservation-filters-url";

interface AdminReservationFiltersProps {
  query: string;
  date: string;
  status: string | undefined;
  maxDate: string;
}

const SEARCH_DEBOUNCE_MS = 500;

export function AdminReservationFilters({ query, date, status, maxDate }: AdminReservationFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(query);
  const [dateValue, setDateValue] = useState(date);
  const dateValueRef = useRef(date);
  const isFirstSearchSync = useRef(true);

  useEffect(() => {
    if (isFirstSearchSync.current) {
      isFirstSearchSync.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.replace(buildAdminFilterHref({ status, query: searchValue, date: dateValueRef.current }));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [router, searchValue, status]);

  const updateDate = (value: string) => {
    setDateValue(value);
    dateValueRef.current = value;
    router.replace(buildAdminFilterHref({ status, query: searchValue, date: value }));
  };

  const hasActiveFilters = searchParams.has("q") || searchParams.has("date") || searchParams.has("status");

  return (
    <section className="card grid two" aria-label="Filtros de reservas">
      <label>Buscar cliente, email, teléfono o zona
        <input
          name="q"
          maxLength={100}
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Ej: Laura, admin@email.com, Terraza"
        />
      </label>
      <label>Fecha exacta
        <input
          name="date"
          type="date"
          max={maxDate}
          value={dateValue}
          onChange={(event) => updateDate(event.target.value)}
        />
      </label>
      <p className="muted">Los filtros se aplican automáticamente.</p>
      {hasActiveFilters ? <Link className="button secondary" href="/admin">Limpiar filtros</Link> : null}
    </section>
  );
}
