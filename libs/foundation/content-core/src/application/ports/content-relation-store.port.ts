import type { Observable } from 'rxjs';
import type { Result } from '@foundation/standard';
import type { ContentRelation, ContentRelationId } from '../models/content-relation.dto';
import type { ContentId } from '../models/content-id';
import type { RelationType } from '../constants';

/**
 * Store for first-class content relations (ADR-0002).
 * Relations are append-only, immutable semantic facts.
 * Deletion or hiding is handled at the content level, not by mutating relations.
 */
export interface ContentRelationStore {
  add(
    relation: Omit<ContentRelation, 'id' | 'createdAt'> & {
      id?: ContentRelationId;
      createdAt?: Date;
    }
  ): Observable<Result<ContentRelation, Error>>;

  findByFrom(
    fromContentId: ContentId,
    relationType?: RelationType
  ): Observable<Result<ContentRelation[], Error>>;

  findByTo(
    toContentId: ContentId,
    relationType?: RelationType
  ): Observable<Result<ContentRelation[], Error>>;
}
