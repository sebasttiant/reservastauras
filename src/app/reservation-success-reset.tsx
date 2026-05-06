"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const RESERVATION_SUCCESS_RESET_DELAY_MS = 10_000;

export function ReservationSuccessReset() {
  const router = useRouter();

  useEffect(() => {
    window.history.replaceState(null, "", "/");

    const timeoutId = window.setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, RESERVATION_SUCCESS_RESET_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  return null;
}
