// route-path.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { buildRoutePath, RoutePathOptions } from './build-route-path';

export type RoutePathMode = 'segments' | 'string';

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
    mode: RoutePathMode = 'segments',
    opts: RoutePathOptions = { strict: false }
  ): string | string[] {
    const result = buildRoutePath(path, params, opts);
    
    if (mode === 'string') {
      return result;
    }
    
    // return routerLink-friendly segments
    const segments = result.split('/').filter(Boolean);
    return segments.length ? segments : [''];
  }
}
