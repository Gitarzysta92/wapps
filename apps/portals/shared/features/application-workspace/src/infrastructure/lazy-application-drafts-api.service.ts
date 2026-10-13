import { inject, Injectable, Injector } from '@angular/core';
import { defer, switchMap, type Observable } from 'rxjs';
import type {
  ApplicationDraftChange,
  ApplicationDraftsPort,
} from '../application/application-drafts.port';

@Injectable()
export class LazyApplicationDraftsApiService implements ApplicationDraftsPort {
  private readonly injector = inject(Injector);
  list() {
    return this.request((api) => api.list());
  }
  read(id: string) {
    return this.request((api) => api.read(id));
  }
  change(command: ApplicationDraftChange, key: string) {
    return this.request((api) => api.change(command, key));
  }
  private request<T>(
    operation: (api: ApplicationDraftsPort) => Observable<T>
  ): Observable<T> {
    return defer(() => import('./application-drafts-api.service')).pipe(
      switchMap(({ ApplicationDraftsApiService }) =>
        operation(this.injector.get(ApplicationDraftsApiService))
      )
    );
  }
}
