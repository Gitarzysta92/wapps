import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { ApplicationImageMerge } from '@domains/catalog/media';
import type {
  OwnershipAction,
  OwnershipChangeInput,
  OwnershipClaim,
  OwnershipClaimInput,
  OwnershipPage,
  OwnershipReceipt,
} from '@domains/catalog/ownership';
import type {
  ApplicationDraftFields,
  ApplicationDraftReceipt,
  ApplicationEditingSource,
  ApplicationEditingTarget,
} from '@domains/catalog/record';

export type OwnershipCommand =
  | { action: 'create'; input: OwnershipClaimInput }
  | {
      action: Exclude<OwnershipAction, 'create'>;
      id: string;
      input: OwnershipChangeInput;
    };
export interface OwnershipApplication {
  id: string;
  name: string;
  slug: string;
  website: string | null;
}
export interface ApplicationOwnershipPort {
  application(slug: string): Observable<Result<OwnershipApplication, Error>>;
  list(
    review: boolean,
    page: number,
    grants?: boolean
  ): Observable<Result<OwnershipPage, Error>>;
  read(id: string, review: boolean): Observable<Result<OwnershipClaim, Error>>;
  change(
    command: OwnershipCommand,
    key: string
  ): Observable<Result<OwnershipReceipt, Error>>;
}
export interface ApplicationEditingCommand {
  type: 'open' | 'rebase';
  id: string | null;
  expectedRevision: number | null;
  editing: ApplicationEditingTarget;
  fields: ApplicationDraftFields;
  imageChoices?: ApplicationImageMerge;
}
export interface ApplicationEditingPort {
  source(
    applicationId: string
  ): Observable<Result<ApplicationEditingSource, Error>>;
  edit(
    command: ApplicationEditingCommand,
    key: string
  ): Observable<Result<ApplicationDraftReceipt, Error>>;
}
export const APPLICATION_OWNERSHIP =
  new InjectionToken<ApplicationOwnershipPort>('APPLICATION_OWNERSHIP');
export const APPLICATION_EDITING = new InjectionToken<ApplicationEditingPort>(
  'APPLICATION_EDITING'
);
