import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  PublishedRelease,
  ReleaseBrowseFilter,
  ReleaseDraft,
  ReleaseFields,
  ReleasePage,
  ReleasePublicationAction,
  ReleasePublicationInput,
  ReleasePublicationReceipt,
  ReleasePublicationStatus,
  ReleaseReceipt,
  ReleaseReviewPage,
  ReleaseSource,
} from '@domains/catalog/versioning';

export type ReleaseDraftChange =
  | {
      kind: 'draft';
      type: 'create';
      input: { applicationId: string; claimId: string; fields: ReleaseFields };
    }
  | {
      kind: 'draft';
      type: 'open';
      input: {
        applicationId: string;
        claimId: string;
        releaseId: string;
        expectedPublicationRevision: number;
      };
    }
  | {
      kind: 'draft';
      type: 'update' | 'rebase';
      id: string;
      input: {
        expectedRevision: number;
        fields: ReleaseFields;
        expectedPublicationRevision?: number | null;
      };
    }
  | {
      kind: 'draft';
      type: 'delete';
      id: string;
      input: { expectedRevision: number };
    };
export interface ReleasePublicationChange {
  kind: 'publication';
  id: string;
  action: ReleasePublicationAction;
  input: ReleasePublicationInput;
}
export type ReleaseChange = ReleaseDraftChange | ReleasePublicationChange;
export type ReleaseChangeReceipt = ReleaseReceipt | ReleasePublicationReceipt;
export interface ReleaseWorkspacePort {
  list(): Observable<Result<ReleaseDraft[], Error>>;
  read(id: string): Observable<Result<ReleaseDraft, Error>>;
  source(
    applicationId: string,
    releaseId: string | null
  ): Observable<Result<ReleaseSource, Error>>;
  status(
    id: string,
    review: boolean
  ): Observable<Result<ReleasePublicationStatus, Error>>;
  reviews(page: number): Observable<Result<ReleaseReviewPage, Error>>;
  change(
    command: ReleaseChange,
    key: string
  ): Observable<Result<ReleaseChangeReceipt, Error>>;
}
export interface ReleaseCatalogPort {
  browse(
    slug: string,
    page: number,
    filter?: ReleaseBrowseFilter
  ): Observable<Result<ReleasePage, Error>>;
  find(
    slug: string,
    version: string
  ): Observable<Result<PublishedRelease, Error>>;
}
export class ReleaseRequestError extends Error {
  constructor(
    message: string,
    readonly uncertain = false,
    readonly status = 0
  ) {
    super(message);
  }
}
export const RELEASE_WORKSPACE = new InjectionToken<ReleaseWorkspacePort>(
  'RELEASE_WORKSPACE'
);
export const RELEASE_CATALOG = new InjectionToken<ReleaseCatalogPort>(
  'RELEASE_CATALOG'
);
