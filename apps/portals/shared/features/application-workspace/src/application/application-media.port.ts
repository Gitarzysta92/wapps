import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { ApplicationDraftReceipt } from '@domains/catalog/record';
import type {
  ApplicationImageAsset,
  ApplicationImageChange,
  ApplicationImagePurpose,
  ApplicationImageSource,
  ApplicationImageUpload,
  ApplicationImageUploadInput,
  ApplicationImageUploadReceipt,
} from '@domains/catalog/media';

export type ApplicationMediaPreview =
  | { kind: 'upload'; id: string }
  | {
      kind: 'draft' | 'canonical';
      id: string;
      purpose: ApplicationImagePurpose;
    }
  | {
      kind: 'submission';
      id: string;
      purpose: ApplicationImagePurpose;
      revision: number;
      review: boolean;
    };
export type ApplicationMediaIntent =
  | { type: 'reserve'; draftId: string; input: ApplicationImageUploadInput }
  | {
      type: 'upload';
      draftId: string;
      id: string;
      source: ApplicationImageSource;
      expectedRevision: number;
    }
  | { type: 'cancel'; draftId: string; id: string; expectedRevision: number }
  | { type: 'attach'; draftId: string; input: ApplicationImageChange };
export interface ApplicationMediaAttempt {
  intent: ApplicationMediaIntent;
  key: string;
}
export interface ApplicationMediaPort {
  inspect(file: File): Observable<Result<ApplicationImageSource, Error>>;
  list(draftId: string): Observable<Result<ApplicationImageUpload[], Error>>;
  read(id: string): Observable<Result<ApplicationImageUpload, Error>>;
  reserve(
    input: ApplicationImageUploadInput,
    key: string
  ): Observable<Result<ApplicationImageUploadReceipt, Error>>;
  upload(
    id: string,
    revision: number,
    file: File,
    key: string
  ): Observable<Result<ApplicationImageUploadReceipt, Error>>;
  cancel(
    id: string,
    revision: number,
    key: string
  ): Observable<Result<ApplicationImageUploadReceipt, Error>>;
  attach(
    draftId: string,
    input: ApplicationImageChange,
    key: string
  ): Observable<Result<ApplicationDraftReceipt, Error>>;
  preview(
    target: ApplicationMediaPreview,
    asset: ApplicationImageAsset
  ): Observable<Result<Blob, Error>>;
}
export interface ApplicationMediaRecoveryPort {
  restore(
    session: string
  ): Observable<Result<ApplicationMediaAttempt | null, Error>>;
  remember(
    session: string,
    attempt: ApplicationMediaAttempt | null
  ): Observable<Result<void, Error>>;
  clear(): void;
}
export const APPLICATION_MEDIA = new InjectionToken<ApplicationMediaPort>(
  'APPLICATION_MEDIA'
);
export const APPLICATION_MEDIA_RECOVERY =
  new InjectionToken<ApplicationMediaRecoveryPort>(
    'APPLICATION_MEDIA_RECOVERY'
  );
