/**
 * Environment configuration for Catalog Portal
 *
 * Catalog uses catalog-bff as the source of data.
 * - Local: catalog-bff at http://localhost:3000/api
 * - Deployed: catalog.<env>.wapps.com/api (e.g. catalog.development.wapps.com/api)
 */
export const ENVIRONMENT_NAME = "";

/**
 * Base domain for all services
 */
export const BASE_DOMAIN = "wapps.com";

/**
 * Base URL for catalog-bff API (includes /api prefix).
 * catalog-bff uses setGlobalPrefix('api'), routes are /api/catalog/apps, /api/catalog/apps/:slug.
 */
export function getCatalogApiBaseUrl(): string {
  if (!ENVIRONMENT_NAME) {
    return "http://localhost:3000/api";
  }
  return `http://catalog.${ENVIRONMENT_NAME}.${BASE_DOMAIN}/api`;
}

/** Injected as CATALOG_API_URL; used by CatalogApiService to build /api/catalog/apps, /api/catalog/apps/:slug */
export const CATALOG_API_BASE_URL = getCatalogApiBaseUrl();
