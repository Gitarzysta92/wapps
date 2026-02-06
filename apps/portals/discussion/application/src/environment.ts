/**
 * Discussion Portal environment helpers.
 *
 * We primarily need AUTH BFF URL for login feature.
 * - localhost → http://localhost:8080 (firebase-auth-validator running locally)
 * - *.wapps.com → https://auth.<env>.wapps.com (env derived from host)
 */
export function getAuthBffUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8080';
  }

  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') {
    return 'http://localhost:8080';
  }

  if (h.endsWith('.wapps.com')) {
    const parts = h.split('.');
    const env = parts.length >= 3 ? parts[parts.length - 3] : 'development';
    return `https://auth.${env}.wapps.com`;
  }

  return 'http://localhost:8080';
}

export const AUTH_BFF_URL = getAuthBffUrl();

