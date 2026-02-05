import { Uuidv7 } from '@foundation/standard';

type AuthorityNodeRelationBase = {
  id: Uuidv7;
  fromNodeId: Uuidv7;
  toNodeId: Uuidv7;
  createdAt: number;
  deletedAt?: number;
};

/**
 * Authority relations are the primary way to model meaning in the graph.
 *
 * We keep relations strongly typed (discriminated union) so:
 * - semantics live in `relationType` (no generic attributes bag)
 * - future relation variants can introduce explicit required fields without
 *   breaking existing ones
 */
export type AuthorityRelationType =
  | 'member_of'
  | 'has_role'
  | 'grants'
  | 'owns'
  | 'relates_to';

export type IAuthorityNodeRelation =
  | (AuthorityNodeRelationBase & { relationType: 'member_of' })
  | (AuthorityNodeRelationBase & { relationType: 'has_role' })
  | (AuthorityNodeRelationBase & { relationType: 'grants' })
  | (AuthorityNodeRelationBase & { relationType: 'owns' })
  | (AuthorityNodeRelationBase & { relationType: 'relates_to' });

