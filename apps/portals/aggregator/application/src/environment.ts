import { CATALOG_MODE } from './catalog-mode';
export { CATALOG_MODE } from './catalog-mode';

/**
 * Environment configuration
 * 
 * URL pattern: <resource>.<environment>.wapps.ai
 * 
 * ENVIRONMENT_NAME values:
 * - "" (empty): Local development with same-origin service gateways
 * - "development": Development environment
 * - "staging": Staging environment  
 * - "production": Production environment
 */
export const ENVIRONMENT_NAME = "";

/**
 * Base domain for all services
 */
export const BASE_DOMAIN = "wapps.ai";

/**
 * Build a service URL based on environment
 * @param resource - Resource name (e.g., 'auth', 'api', 'avatar')
 * @returns Full URL or empty string for local development
 */
export function buildServiceUrl(resource: string): string {
  if (!ENVIRONMENT_NAME) {
    return ""; // Identity uses the explicitly selected same-origin gateway.
  }
  return `https://${resource}.${ENVIRONMENT_NAME}.${BASE_DOMAIN}`;
}

// Pre-built service URLs for convenience
export const AVATAR_BASE_URL = buildServiceUrl("avatar");
export const API_BASE_URL = buildServiceUrl("api");
export const AUTH_BFF_URL = buildServiceUrl("auth");
export const USE_CATALOG_BFF = CATALOG_MODE === 'api';
