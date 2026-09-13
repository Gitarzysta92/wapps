import { Uuidv7 } from '@sdk/kernel/standard';

/**
 * Identity graph relation between two identity nodes.
 *
 * Keep this shape stable; it is persisted and queried directly by services.
 */
export interface IIdentityNodeRelation {
  id: Uuidv7;
  fromIdentityId: Uuidv7;
  toIdentityId: Uuidv7;
  relationType?: string;
  createdAt: number;
  deletedAt?: number;
}

