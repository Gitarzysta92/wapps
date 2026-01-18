/**
 * Environment configuration for Catalog Portal
 * 
 * URL pattern: <resource>.<environment>.wapps.com
 * 
 * ENVIRONMENT_NAME values:
 * - "" (empty): Local development, uses mock services or localhost
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
 * Build a service URL based on environment
 * @param resource - Resource name (e.g., 'catalog', 'api')
 * @returns Full URL or localhost URL for local development
 */
export function buildServiceUrl(resource: string, port?: number): string {
  if (!ENVIRONMENT_NAME) {
    // Local development - use localhost with port
    if (port) {
      return `http://localhost:${port}`;
    }
    return "";
  }
  return `https://${resource}.${ENVIRONMENT_NAME}.${BASE_DOMAIN}`;
}

// Pre-built service URLs for convenience
export const CATALOG_BFF_URL = buildServiceUrl("catalog", 3000);
export const API_BASE_URL = buildServiceUrl("api");
