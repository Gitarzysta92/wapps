import { inject, Injectable, Injector } from '@angular/core';
import { defer, switchMap, type Observable } from 'rxjs';
import type {
  ApplicationPublicationChange,
  ApplicationPublicationPort,
} from '../application/application-publication.port';

/** Keep publication transport/parsers out of the portal's initial bundle while retaining a root-scoped client. */
@Injectable()
export class LazyApplicationPublicationApiService
  implements ApplicationPublicationPort
{
  private readonly injector = inject(Injector);
  status(id: string, review: boolean) {
    return this.request((api) => api.status(id, review));
  }
  reviews(page: number) {
    return this.request((api) => api.reviews(page));
  }
  change(command: ApplicationPublicationChange, key: string) {
    return this.request((api) => api.change(command, key));
  }
  private request<T>(
    operation: (api: ApplicationPublicationPort) => Observable<T>
  ): Observable<T> {
    return defer(() => import('./application-publication-api.service')).pipe(
      switchMap(({ ApplicationPublicationApiService }) =>
        operation(this.injector.get(ApplicationPublicationApiService))
      )
    );
  }
}
