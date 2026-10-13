import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  ApplicationDraft,
  ApplicationDraftFields,
  ApplicationDraftReceipt,
} from '@domains/catalog/record';

export interface ApplicationDraftChange {
  type: 'create' | 'update' | 'delete';
  id: string | null;
  expectedRevision: number | null;
  fields: ApplicationDraftFields | null;
}
export interface ApplicationDraftsPort {
  list(): Observable<Result<ApplicationDraft[], Error>>;
  read(id: string): Observable<Result<ApplicationDraft, Error>>;
  change(
    command: ApplicationDraftChange,
    key: string
  ): Observable<Result<ApplicationDraftReceipt, Error>>;
}
export interface ApplicationWorkspaceSession {
  key$: Observable<string | null>;
  currentKey(): string | null;
}
export class ApplicationDraftRequestError extends Error {
  constructor(
    readonly uncertain: boolean,
    message: string,
    readonly status = 0
  ) {
    super(message);
  }
}
export const APPLICATION_DRAFTS = new InjectionToken<ApplicationDraftsPort>(
  'APPLICATION_DRAFTS'
);
export const APPLICATION_WORKSPACE_SESSION =
  new InjectionToken<ApplicationWorkspaceSession>(
    'APPLICATION_WORKSPACE_SESSION'
  );
export const APPLICATION_WORKSPACE_ORIGIN = new InjectionToken<string>(
  'APPLICATION_WORKSPACE_ORIGIN'
);
