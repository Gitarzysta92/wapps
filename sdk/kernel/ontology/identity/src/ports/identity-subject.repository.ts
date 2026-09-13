import { Result } from '@sdk/kernel/standard';
import { IIdentitySubject } from '../entities/identity-subject';

export interface IIdentitySubjectRepository<T extends IIdentitySubject = IIdentitySubject> {
  /**
   * Create or update (idempotent) by `id`.
   * Implementations should treat this as an upsert.
   */
  upsert(subject: T): Promise<Result<boolean, Error>>;

  /**
   * Get an external subject by provider type + external id/claim.
   * Returns `null` when not found.
   */
  getByProviderExternalId(providerType: string, externalId: string): Promise<Result<T | null, Error>>;

  deleteById(id: string): Promise<Result<boolean, Error>>;
}

