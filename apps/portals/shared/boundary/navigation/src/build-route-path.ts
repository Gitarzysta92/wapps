export interface RoutePathOptions {
  strict?: boolean;
  absolute?: boolean;
}

/**
 * Reusable function to transform route paths with parameter substitution.
 *
 * Examples:
 *  buildRoutePath('app/:appSlug/health', {appSlug:'wapps'})    -> 'app/wapps/health'
 */
export function buildRoutePath(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
  opts: RoutePathOptions = { strict: false }
): string {
  if (!path) return '/';

  const replaced = path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const v = params[key];
    if (v === undefined || v === null || v === '') {
      if (opts.strict) {
        throw new Error(`Missing route param ":${key}" for path "${path}"`);
      }
      // non-strict: leave the token in place so you can spot it
      return `:${key}`;
    }
    return encodeURIComponent(String(v));
  });

  // normalize duplicate slashes (in case of missing/empty param in non-strict mode)
  const normalized = replaced.replace(/\/{2,}/g, '/').replace(/\/+$/g, '');

  return opts.absolute ? `/${normalized}` : normalized;
}

