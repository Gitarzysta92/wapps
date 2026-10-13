import type { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { ok, err, type Result } from '@sdk/kernel/standard';
import {
  accountExportId,
  isCanonicalIdentityId,
  parseAccountExportJob,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  CanonicalIdentityConflict,
} from '@sdk/features/identity/core';
import type { AccountExportStore } from './ports/account-export.port';
import type { IdentityManagementContext } from './models/identity-management-context';

export class AccountExportService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly store: AccountExportStore
  ) {}
  request(key: unknown, ctx: IdentityManagementContext) {
    return this.run(ctx, async () => {
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
        throw new CanonicalIdentityInputError(
          'A valid Idempotency-Key is required'
        );
      return this.job(await this.store.request(ctx.identityId, key));
    });
  }
  latest(ctx: IdentityManagementContext) {
    return this.run(ctx, async () => {
      const value = await this.store.latest(ctx.identityId);
      return value === null ? null : this.job(value);
    });
  }
  inspect(id: unknown, ctx: IdentityManagementContext) {
    return this.run(ctx, async () =>
      this.job(
        await this.store.inspect(ctx.identityId, accountExportId(id)),
        id
      )
    );
  }
  cancel(id: unknown, ctx: IdentityManagementContext) {
    return this.run(ctx, async () =>
      this.job(await this.store.cancel(ctx.identityId, accountExportId(id)), id)
    );
  }
  download(id: unknown, ctx: IdentityManagementContext) {
    return this.run(ctx, async () => {
      const job = this.job(
        await this.store.inspect(ctx.identityId, accountExportId(id)),
        id
      );
      if (job.status !== 'ready')
        throw new CanonicalIdentityConflict(
          'This account export is not ready for download'
        );
      return { job, chunks: this.store.download(ctx.identityId, job.id) };
    });
  }
  private job(input: unknown, expectedId?: unknown) {
    try {
      const job = parseAccountExportJob(input);
      if (expectedId !== undefined && job.id !== expectedId)
        throw new Error('Mismatched export ID');
      return job;
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Account export status is unavailable'
      );
    }
  }
  private async run<T>(
    ctx: IdentityManagementContext,
    operation: () => Promise<T>
  ): Promise<Result<T, Error>> {
    try {
      if (!isCanonicalIdentityId(ctx.identityId))
        throw new CanonicalIdentityAccessDenied('Authentication required');
      const result = await this.authority.validate({
        ...ctx,
        timestamp: Date.now(),
        actionName: 'identity.account-export.manage',
        resource: { type: 'user', id: ctx.identityId },
      });
      if (!result.ok)
        throw new CanonicalIdentityUnavailable(
          'Account export authorization unavailable'
        );
      if (result.value !== true)
        throw new CanonicalIdentityAccessDenied('Account export access denied');
      return ok(await operation());
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new CanonicalIdentityUnavailable('Account export unavailable')
      );
    }
  }
}
