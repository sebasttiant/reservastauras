import "server-only";

import { headers as nextHeaders } from "next/headers";

export interface RequestSecurityContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export function getRequestSecurityContext(headers: Headers): RequestSecurityContext {
  return {
    ipAddress: getClientIpAddress(headers),
    userAgent: normalizeHeaderValue(headers.get("user-agent")),
  };
}

export async function getCurrentRequestSecurityContext(): Promise<RequestSecurityContext> {
  return getRequestSecurityContext(await nextHeaders());
}

export function isValidAdminMutationOrigin(headers: Headers): boolean {
  const origin = parseOrigin(headers.get("origin"));
  if (!origin) return false;

  const allowedHosts = getAllowedHosts(headers);
  const allowedProtocols = getAllowedProtocols(headers);
  const originProtocol = origin.protocol.slice(0, -1);

  return allowedHosts.has(origin.host) && (allowedProtocols.size === 0 || allowedProtocols.has(originProtocol));
}

export async function assertValidAdminMutationOrigin(): Promise<void> {
  if (!isValidAdminMutationOrigin(await nextHeaders())) {
    throw new Error("Invalid admin mutation origin.");
  }
}

function getClientIpAddress(headers: Headers): string | null {
  const cfConnectingIp = normalizeHeaderValue(headers.get("cf-connecting-ip"));
  if (cfConnectingIp) return cfConnectingIp;

  const forwardedFor = normalizeHeaderValue(headers.get("x-forwarded-for"));
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

function getAllowedHosts(headers: Headers): Set<string> {
  const values = [headers.get("host"), headers.get("x-forwarded-host")];
  const hosts = values.flatMap((value) => normalizeForwardedHosts(value));
  return new Set(hosts);
}

function getAllowedProtocols(headers: Headers): Set<string> {
  const normalized = normalizeHeaderValue(headers.get("x-forwarded-proto"));
  if (!normalized) return new Set();

  const protocols = normalized
    .split(",")
    .map((protocol) => protocol.trim().toLowerCase())
    .filter((protocol) => protocol === "http" || protocol === "https");

  return new Set(protocols);
}

function normalizeForwardedHosts(value: string | null): string[] {
  const normalized = normalizeHeaderValue(value);
  if (!normalized) return [];

  return normalized
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function parseOrigin(value: string | null): URL | null {
  const normalized = normalizeHeaderValue(value);
  if (!normalized) return null;

  try {
    const origin = new URL(normalized);
    if (origin.protocol !== "http:" && origin.protocol !== "https:") return null;
    return origin;
  } catch {
    return null;
  }
}

function normalizeHeaderValue(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
