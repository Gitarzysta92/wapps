import { inject, Injectable, Injector } from '@angular/core';
import { defer, switchMap, type Observable } from 'rxjs';
import type {
  ApplicationOwnershipPort,
  ApplicationEditingPort,
  ApplicationEditingCommand,
  OwnershipCommand,
} from '../application/application-ownership.port';

@Injectable()
export class LazyApplicationOwnershipApiService
  implements ApplicationOwnershipPort, ApplicationEditingPort
{
  private readonly injector = inject(Injector);
  application(slug: string) {
    return this.request((api) => api.application(slug));
  }
  list(review: boolean, page: number, grants = false) {
    return this.request((api) => api.list(review, page, grants));
  }
  read(id: string, review: boolean) {
    return this.request((api) => api.read(id, review));
  }
  change(command: OwnershipCommand, key: string) {
    return this.request((api) => api.change(command, key));
  }
  source(id: string) {
    return this.request((api) => api.source(id));
  }
  edit(command: ApplicationEditingCommand, key: string) {
    return this.request((api) => api.edit(command, key));
  }
  private request<T>(
    operation: (
      api: ApplicationOwnershipPort & ApplicationEditingPort
    ) => Observable<T>
  ): Observable<T> {
    return defer(() => import('./application-ownership-api.service')).pipe(
      switchMap(({ ApplicationOwnershipApiService }) =>
        operation(this.injector.get(ApplicationOwnershipApiService))
      )
    );
  }
}
