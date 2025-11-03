//TODO: ensure if this logic is necessary.

/**
 * Builds a URL query string from an object of key-value pairs.
 * 
 * @param params - Object containing query parameters
 * @returns Query string starting with '?' (e.g., '?key1=value1&key2=value2') or empty string if no params
 * 
 * @example
 * buildQueryString({ search: 'test', page: '1' }) // returns '?search=test&page=1'
 * buildQueryString({}) // returns ''
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const entries = Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => [encodeURIComponent(key), encodeURIComponent(String(value))]);

  if (entries.length === 0) {
    return '';
  }

  return '?' + entries.map(([key, value]) => `${key}=${value}`).join('&');
}

