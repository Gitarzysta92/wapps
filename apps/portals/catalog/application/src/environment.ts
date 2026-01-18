/**
 * Environment configuration for Catalog Portal
 *
 * Catalog uses catalog-bff as the source of data.
 * API and CDN hostnames are resolved at runtime from window.location.hostname:
 * - *.wapps.com     → catalog.<env>.wapps.com, cdn.<env>.wapps.com  (env from host, e.g. catalog-csr.development.wapps.com → development)
 * - *appcatalog.pl  → catalog.appcatalog.pl, cdn.appcatalog.pl
 * - localhost       → http://localhost:3000/api, CDN empty
 */
export function getCatalogApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:3000/api";
  }
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") {
    return "http://localhost:3000/api";
  }
  if (h.endsWith(".wapps.com")) {
    const parts = h.split(".");
    const env = parts.length >= 3 ? parts[parts.length - 3] : "development";
    return `https://catalog.${env}.wapps.com/api`;
  }
  if (h === "appcatalog.pl" || h.endsWith(".appcatalog.pl")) {
    return "https://catalog.appcatalog.pl/api";
  }
  return "http://localhost:3000/api";
}

/**
 * Base URL for CDN (avatars, logos, etc.). Resolved at runtime from window.location.hostname.
 */
export function getCdnBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "";
  if (h.endsWith(".wapps.com")) {
    const parts = h.split(".");
    const env = parts.length >= 3 ? parts[parts.length - 3] : "development";
    return `https://cdn.${env}.wapps.com`;
  }
  if (h === "appcatalog.pl" || h.endsWith(".appcatalog.pl")) {
    return "https://cdn.appcatalog.pl";
  }
  return "";
}

/** Injected as CATALOG_API_URL; used by CatalogApiService to build /api/catalog/apps, /api/catalog/apps/:slug */
export const CATALOG_API_BASE_URL = getCatalogApiBaseUrl();
