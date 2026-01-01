/**
 * Environment configuration
 * 
 * URL pattern: <resource>.<environment>.wapps.com
 * 
 * ENVIRONMENT_NAME values:
 * - "" (empty): Local development, uses mock services
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
 * @param resource - Resource name (e.g., 'auth', 'api', 'avatar')
 * @returns Full URL or empty string for local development
 */
export function buildServiceUrl(resource: string): string {
  if (!ENVIRONMENT_NAME) {
    return ""; // Local development - uses mock services
  }
  return `https://${resource}.${ENVIRONMENT_NAME}.${BASE_DOMAIN}`;
}

// Pre-built service URLs for convenience
export const AVATAR_BASE_URL = buildServiceUrl("avatar");
export const API_BASE_URL = buildServiceUrl("api");
export const AUTH_BFF_URL = buildServiceUrl("auth");