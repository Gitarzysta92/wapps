import type { ContentId } from './content-id';
import type { RelationType } from '../constants';

/** Opaque identifier for a content relation. */
export type ContentRelationId = string & { readonly __brand: 'ContentRelationId' };

export function asContentRelationId(id: string): ContentRelationId {
  return id as ContentRelationId;
}

/**
 * First-class, typed, directional relation between two Content entities (ADR-0002).
 * Stored in a separate relation store; append-only and immutable.
 * Nesting and hierarchy emerge via traversal and projections, not from this model.
 */
export type ContentRelation = {
  readonly id: ContentRelationId;
  readonly fromContentId: ContentId;
  readonly toContentId: ContentId;
  readonly relationType: RelationType;
  readonly createdAt: Date;
};
