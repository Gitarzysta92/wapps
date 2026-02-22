import { Result } from '@sdk/kernel/standard';
import { IIdentitySubject } from '../entities/identity-subject';

export interface IIdentitySubjectRepository<T extends IIdentitySubject> {

  /**
   * Get an external subject by provider+external id.
   * Returns `null` when not found.
   */

  /**
   * Create or update (idempotent) by `id`.
   * Implementations should treat this as an upsert.
   */
  upsert(subject: Omit<IIdentitySubject, 'id'>): Promise<Result<boolean, Error>>;
  getByClaim(claim: string): Promise<Result<T, Error>>
  deleteById(id: string): Promise<Result<boolean, Error>>;
}

