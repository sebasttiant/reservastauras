"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSupportedPublicLanguage } from "@/lib/i18n/public-reservation-dictionary";
import { DEFAULT_PUBLIC_LANGUAGE } from "@/lib/i18n/language";

const RESERVATION_SUCCESS_RESET_DELAY_MS = 16_000;

type ReservationSuccessResetPath = "/" | "/?lang=es";

export function buildReservationSuccessResetUrl(currentUrl: string): ReservationSuccessResetPath {
  const url = new URL(currentUrl);
  const supportedLanguage = url.searchParams.get("lang");

  if (isSupportedPublicLanguage(supportedLanguage) && supportedLanguage !== DEFAULT_PUBLIC_LANGUAGE) {
    return `/?lang=${supportedLanguage}`;
  }

  return "/";
}

export function ReservationSuccessReset() {
  const router = useRouter();

  useEffect(() => {
    const resetUrl = buildReservationSuccessResetUrl(window.location.href);
    window.history.replaceState(null, "", resetUrl);

    const timeoutId = window.setTimeout(() => {
      router.replace(resetUrl);
      router.refresh();
    }, RESERVATION_SUCCESS_RESET_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  return null;
}
