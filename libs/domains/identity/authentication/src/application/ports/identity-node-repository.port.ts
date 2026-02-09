import { Result } from '@foundation/standard';
import { IIdentityNode } from '@foundation/identity-system';

export interface IIdentityNodeRepository {
  /**
   * Create the identity node if it doesn't exist.
   * Implementations should be idempotent.
   */
  createIfNotExists(node: IIdentityNode): Promise<Result<boolean, Error>>;

  deleteById(id: string): Promise<Result<boolean, Error>>;
}

