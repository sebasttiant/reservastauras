import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservas Tauras",
  description: "Sistema de reservas con confirmación humana para Tauras.",
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
