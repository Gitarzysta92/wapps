import { inject, Injectable, Injector } from '@angular/core';
import { defer, switchMap, type Observable } from 'rxjs';
import type {
  ApplicationImageAsset,
  ApplicationImageChange,
  ApplicationImageUploadInput,
} from '@domains/catalog/media';
import type {
  ApplicationMediaAttempt,
  ApplicationMediaPort,
  ApplicationMediaPreview,
  ApplicationMediaRecoveryPort,
} from '../application/application-media.port';

@Injectable()
export class LazyApplicationMediaApiService
  implements ApplicationMediaPort, ApplicationMediaRecoveryPort
{
  private readonly injector = inject(Injector);
  private recovery?: ApplicationMediaRecoveryPort;
  inspect(file: File) {
    return this.request((api) => api.inspect(file));
  }
  list(draftId: string) {
    return this.request((api) => api.list(draftId));
  }
  read(id: string) {
    return this.request((api) => api.read(id));
  }
  reserve(input: ApplicationImageUploadInput, key: string) {
    return this.request((api) => api.reserve(input, key));
  }
  upload(id: string, revision: number, file: File, key: string) {
    return this.request((api) => api.upload(id, revision, file, key));
  }
  cancel(id: string, revision: number, key: string) {
    return this.request((api) => api.cancel(id, revision, key));
  }
  attach(draftId: string, input: ApplicationImageChange, key: string) {
    return this.request((api) => api.attach(draftId, input, key));
  }
  preview(target: ApplicationMediaPreview, asset: ApplicationImageAsset) {
    return this.request((api) => api.preview(target, asset));
  }
  restore(session: string) {
    return this.recover((store) => store.restore(session));
  }
  remember(session: string, attempt: ApplicationMediaAttempt | null) {
    return this.recover((store) => store.remember(session, attempt));
  }
  clear() {
    this.recovery?.clear();
  }
  private request<T>(operation: (api: ApplicationMediaPort) => Observable<T>) {
    return defer(() => import('./application-media-api.service')).pipe(
      switchMap(({ ApplicationMediaApiService }) =>
        operation(this.injector.get(ApplicationMediaApiService))
      )
    );
  }
  private recover<T>(
    operation: (store: ApplicationMediaRecoveryPort) => Observable<T>
  ) {
    return defer(() => import('./application-media-recovery.service')).pipe(
      switchMap(({ ApplicationMediaRecoveryService }) => {
        this.recovery = this.injector.get(ApplicationMediaRecoveryService);
        return operation(this.recovery);
      })
    );
  }
}
