import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import {
  accountExportObject,
  isCanonicalIdentityId,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import type { AccountExportSource } from './ports/account-export.port';

export const ACCOUNT_EXPORT_READER = 'wapps-account-export-reader';
export const ACCOUNT_EXPORT_READER_ROLE = 'account-export:reader';
export const ACCOUNT_EXPORT_READER_SCOPE = 'account-export';
export interface AccountExportSourceActor {
  identityId: string;
  tenantId: string;
  roles: readonly string[];
}

/** Owning services accept only a purpose-specific Account service actor, never an end-user role. */
export class AccountExportSourceAccess {
  constructor(
    private readonly source: AccountExportSource,
    private readonly policy: IPolicyEvaluator
  ) {
    if (source.name !== 'editorial' && source.name !== 'discussion')
      throw new Error(
        'Only remote account export sources require service access'
      );
  }
  async capture(
    input: unknown,
    actor: AccountExportSourceActor,
    signal: AbortSignal
  ) {
    if (
      actor.identityId !== ACCOUNT_EXPORT_READER ||
      actor.tenantId !== ACCOUNT_EXPORT_READER_SCOPE ||
      actor.roles.length !== 1 ||
      actor.roles[0] !== ACCOUNT_EXPORT_READER_ROLE
    )
      throw new CanonicalIdentityAccessDenied(
        'Account export service access required'
      );
    const request = accountExportObject(input, ['identityId']);
    if (!isCanonicalIdentityId(request['identityId']))
      throw new CanonicalIdentityInputError(
        'A canonical export identity is required'
      );
    signal.throwIfAborted();
    const action = `${this.source.name}.account-export.read`;
    const result = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: Date.now(),
      action,
      actionName: action,
      subject: { roles: [...actor.roles] },
      resource: {
        type: 'account-export',
        id: request['identityId'],
        tenantId: ACCOUNT_EXPORT_READER_SCOPE,
      },
    });
    signal.throwIfAborted();
    if (!result.ok)
      throw new CanonicalIdentityUnavailable(
        'Account export source authorization unavailable'
      );
    if (result.value !== true)
      throw new CanonicalIdentityAccessDenied(
        'Account export source access denied'
      );
    return this.source.capture(request['identityId'], signal);
  }
}
