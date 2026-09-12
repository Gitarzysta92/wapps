import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable, catchError, switchMap } from 'rxjs';

/** Warm explicitly marked navigation destinations after the current page can paint. */
@Injectable({ providedIn: 'root' })
export class NavigationPreloadingStrategy implements PreloadingStrategy {
  private readonly view = inject(DOCUMENT).defaultView;

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const view = this.view;
    if (!route.data?.['preload'] || !view) return EMPTY;

    return new Observable<void>(subscriber => {
      const ready = () => { subscriber.next(); subscriber.complete(); };
      if (view.requestIdleCallback) {
        const id = view.requestIdleCallback(ready, { timeout: 2000 });
        return () => view.cancelIdleCallback(id);
      }
      const id = view.setTimeout(ready, 200);
      return () => view.clearTimeout(id);
    }).pipe(switchMap(load), catchError(() => EMPTY));
  }
}
