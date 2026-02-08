import { Result } from '@foundation/standard';
import { IdentityProvider } from './constants';
import { IIdentitySubject } from '../models/identity-subject';

export interface IIdentitySubjectRepository {
  /**
   * Get an external subject by provider+external id.
   * Returns `null` when not found.
   */
  getByProviderExternalId(
    provider: IdentityProvider,
    externalId: string
  ): Promise<Result<IIdentitySubject | null, Error>>;

  /**
   * Create or update (idempotent) by `id`.
   * Implementations should treat this as an upsert.
   */
  upsert(subject: IIdentitySubject): Promise<Result<boolean, Error>>;

  deleteById(id: string): Promise<Result<boolean, Error>>;
}

