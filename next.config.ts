import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// `BEHIND_HTTPS=true` se activa SOLO cuando el sitio se sirve por HTTPS al
// usuario final (TLS terminado en un proxy delante: Caddy, Traefik, Nginx,
// Cloudflare Tunnel, etc.). Si está en `false`, el deploy es HTTP plano
// (típico LAN / IP directa) y NO hay que mandar HSTS ni
// `upgrade-insecure-requests`: el browser intentaría upgradear los
// subrecursos a HTTPS, fallarían los assets y la página se vería sin estilos.
// Default `false` para no romper deploys HTTP por accidente.
const behindHttps = process.env.BEHIND_HTTPS === "true";

// Next App Router inyecta <script>self.__next_f.push(...)</script> con la carga
// RSC y <style> SSR durante streaming. Sin nonces dinámicos por request hace
// falta 'unsafe-inline' para que la página hidrate. En dev además 'unsafe-eval'
// para HMR / Fast Refresh.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isProd ? [] : ["'unsafe-eval'"]),
];

const styleSrc = ["'self'", "'unsafe-inline'"];

const connectSrc = [
  "'self'",
  // Websocket del dev server (HMR + RSC streaming).
  ...(isProd ? [] : ["ws:", "wss:"]),
];

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  `style-src ${styleSrc.join(" ")}`,
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(" ")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(behindHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const permissionsPolicy = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "sync-xhr=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy },
  ...(behindHttps
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
