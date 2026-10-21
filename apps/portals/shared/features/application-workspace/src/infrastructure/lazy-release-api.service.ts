import { inject, Injectable, Injector } from '@angular/core';
import { defer, of, switchMap, type Observable } from 'rxjs';
import { err } from '@sdk/kernel/standard';
import type { ReleaseBrowseFilter } from '@domains/catalog/versioning';
import { APPLICATION_WORKSPACE_SESSION } from '../application/application-drafts.port';
import {
  ReleaseRequestError,
  type ReleaseCatalogPort,
  type ReleaseChange,
  type ReleaseWorkspacePort,
} from '../application/release-workspace.port';

@Injectable()
export class LazyReleaseApiService
  implements ReleaseWorkspacePort, ReleaseCatalogPort
{
  private readonly injector = inject(Injector);
  private readonly session = inject(APPLICATION_WORKSPACE_SESSION);
  list() {
    return this.request((api) => api.list());
  }
  read(id: string) {
    return this.request((api) => api.read(id));
  }
  source(applicationId: string, id: string | null) {
    return this.request((api) => api.source(applicationId, id));
  }
  status(id: string, review: boolean) {
    return this.request((api) => api.status(id, review));
  }
  reviews(page: number) {
    return this.request((api) => api.reviews(page));
  }
  browse(slug: string, page: number, filter?: ReleaseBrowseFilter) {
    return this.request((api) => api.browse(slug, page, filter));
  }
  find(slug: string, version: string) {
    return this.request((api) => api.find(slug, version));
  }
  change(command: ReleaseChange, key: string) {
    const session = this.session.currentKey();
    return this.request((api) =>
      session && session === this.session.currentKey()
        ? api.change(command, key)
        : of(
            err(
              new ReleaseRequestError(
                'The account session changed. Reload before continuing.',
                false,
                401
              )
            )
          )
    );
  }
  private request<T>(
    operation: (api: ReleaseWorkspacePort & ReleaseCatalogPort) => Observable<T>
  ): Observable<T> {
    return defer(() => import('./release-api.service')).pipe(
      switchMap(({ ReleaseApiService }) =>
        operation(this.injector.get(ReleaseApiService))
      )
    );
  }
}
