import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';
import { NAVIGATION } from '../../navigation';

const toDiscover: RedirectFunction = ({ queryParams, params, fragment, routeConfig }) => {
  const applicationListing = routeConfig?.path?.startsWith('app');
  return inject(Router).createUrlTree(['/' + NAVIGATION.discover.path], {
    queryParams: {
      ...(applicationListing ? { type: 'application' } : {}),
      ...queryParams,
      ...params,
    },
    fragment: fragment ?? undefined,
  });
};

// Preserve bookmarked queries, repeated filters, and old path-based category/page values.
export const DISCOVER_REDIRECT_ROUTES: Routes = [
  'search',
  'search/page/:page',
  'app',
  'app/page/:page',
  'app/:category/page/:page',
  'apps',
  'discover/page/:page',
  'discover/:category/page/:page',
].map(path => ({ path, pathMatch: 'full', redirectTo: toDiscover }));
