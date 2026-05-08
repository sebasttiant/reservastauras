import type { Route } from "next";

interface AdminFilterHrefInput {
  status: string | undefined;
  query: string;
  date: string;
}

export function buildAdminFilterHref({ status, query, date }: AdminFilterHrefInput): Route {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();
  const trimmedDate = date.trim();

  if (status) {
    params.set("status", status);
  }

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  if (trimmedDate) {
    params.set("date", trimmedDate);
  }

  const queryString = params.toString();

  return (queryString ? `/admin?${queryString}` : "/admin") as Route;
}
