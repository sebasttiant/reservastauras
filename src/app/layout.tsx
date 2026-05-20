import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Reservas Tauras | Reserva tu mesa",
    template: "%s | Reservas Tauras",
  },
  description:
    "Reserva tu mesa en Tauras Steakhouse, Tauras Bar & Lounge o Tauras Tex Mex con confirmación personalizada del equipo.",
  applicationName: "Reservas Tauras",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  keywords: [
    "Tauras",
    "reservas Tauras",
    "Tauras Steakhouse",
    "Tauras Bar & Lounge",
    "Tauras Tex Mex",
    "reservar restaurante",
  ],
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      es: "/?lang=es",
    },
  },
  openGraph: {
    title: "Reservas Tauras | Reserva tu mesa",
    description:
      "Elige sede, ambiente, fecha y hora. Nuestro equipo revisará tu solicitud y confirmará disponibilidad.",
    siteName: "Reservas Tauras",
    type: "website",
    locale: "es_CO",
    alternateLocale: ["en_US"],
    images: [
      {
        url: "/tauras.png",
        width: 1200,
        height: 630,
        alt: "Tauras Steakhouse",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reservas Tauras | Reserva tu mesa",
    description:
      "Solicita tu reserva en Tauras con confirmación personalizada del equipo.",
    images: ["/tauras.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" as="image" href="/tauras-bg.webp" type="image/webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}
