import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  ArticleCoverSource,
  ArticleCoverUpload,
  ArticleCoverUploadInput,
  ArticleCoverUploadReceipt,
} from '@domains/catalog/media';

export type ArticleCoverPreview =
  | { kind: 'upload'; id: string }
  | { kind: 'submission'; id: string; revision: number; review: boolean }
  | { kind: 'published'; id: string; imageId: string };
export type ArticleCoverIntent =
  | { type: 'reserve'; articleId: string; input: ArticleCoverUploadInput }
  | {
      type: 'upload';
      articleId: string;
      id: string;
      source: ArticleCoverSource;
      expectedRevision: number;
    }
  | { type: 'cancel'; articleId: string; id: string; expectedRevision: number };
export interface ArticleCoverAttempt {
  intent: ArticleCoverIntent;
  key: string;
}
export interface ArticleCoverPort {
  inspect(file: File): Observable<Result<ArticleCoverSource, Error>>;
  list(articleId: string): Observable<Result<ArticleCoverUpload[], Error>>;
  read(id: string): Observable<Result<ArticleCoverUpload, Error>>;
  reserve(
    input: ArticleCoverUploadInput,
    key: string
  ): Observable<Result<ArticleCoverUploadReceipt, Error>>;
  upload(
    id: string,
    revision: number,
    file: File,
    key: string
  ): Observable<Result<ArticleCoverUploadReceipt, Error>>;
  cancel(
    id: string,
    revision: number,
    key: string
  ): Observable<Result<ArticleCoverUploadReceipt, Error>>;
  preview(target: ArticleCoverPreview): Observable<Result<Blob, Error>>;
}
export interface ArticleCoverRecoveryPort {
  restore(
    session: string
  ): Observable<Result<ArticleCoverAttempt | null, Error>>;
  remember(
    session: string,
    attempt: ArticleCoverAttempt | null
  ): Observable<Result<void, Error>>;
  clear(): void;
}
export const ARTICLE_COVERS = new InjectionToken<ArticleCoverPort>(
  'ARTICLE_COVERS'
);
export const ARTICLE_COVERS_RECOVERY =
  new InjectionToken<ArticleCoverRecoveryPort>('ARTICLE_COVERS_RECOVERY');
