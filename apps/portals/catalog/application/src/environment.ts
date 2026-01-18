/**
 * Environment configuration for Catalog Portal
 *
 * Catalog uses catalog-bff as the source of data.
 * - Local: catalog-bff at http://localhost:3000 (global prefix /api → /api/catalog/...)
 * - Deployed: api.<env>.wapps.com (catalog-bff under /api/catalog/...)
 *
 * ENVIRONMENT_NAME values:
 * - "" (empty): Local development, catalog-bff at localhost:3000
 * - "development": Development environment
 * - "staging": Staging environment
 * - "production": Production environment
 */
export const ENVIRONMENT_NAME = "";

/**
 * Base domain for all services
 */
export const BASE_DOMAIN = "wapps.com";

/**
 * Base URL for catalog-bff API (includes /api prefix).
 * catalog-bff uses app.setGlobalPrefix('api'), routes are /api/catalog/apps, /api/catalog/apps/:slug.
 */
export function getCatalogApiBaseUrl(): string {
  if (!ENVIRONMENT_NAME) {
    return "http://localhost:3000/api";
  }
  return `https://api.${ENVIRONMENT_NAME}.${BASE_DOMAIN}/api`;
}

/** Injected as CATALOG_API_URL; used by CatalogApiService to build /api/catalog/apps, /api/catalog/apps/:slug */
export const CATALOG_API_BASE_URL = getCatalogApiBaseUrl();
