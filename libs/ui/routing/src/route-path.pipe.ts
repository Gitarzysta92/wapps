// route-path.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

type Mode = 'segments' | 'string';

@Pipe({
  name: 'routePath',
  standalone: true,
  pure: true,
})
export class RoutePathPipe implements PipeTransform {
  /**
   * Examples:
   *  'app/:appSlug/health' | routePath:{appSlug:'wapps'}                -> ['app','wapps','health']
   *  'app/:appSlug/health' | routePath:{appSlug:'wapps'}:'string'       -> 'app/wapps/health'
   */
  transform(
    path: string,
    params: Record<string, string | number | boolean | null | undefined> = {},
    mode: Mode = 'segments',
    opts: { strict?: boolean } = { strict: false }
  ): string | any[] {
    if (!path) return mode === 'string' ? '/' : ['/'];

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

    if (mode === 'string') return normalized;

    // return routerLink-friendly segments
    const segments = normalized.split('/').filter(Boolean);
    return segments.length ? segments : [''];
  }
}
