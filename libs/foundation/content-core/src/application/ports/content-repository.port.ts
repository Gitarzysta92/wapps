import type { Observable } from 'rxjs';
import type { Result } from '@standard';
import type { Content, ContentRelationRef } from '../models/content.dto';
import type { ContentId } from '../models/content-id';
import type { ContentState, ContentVisibility } from '../constants';

export interface ContentRepository {
  create(
    content: Omit<Content, 'id'> & { id?: ContentId }
  ): Observable<Result<Content, Error>>;
  updateState(id: ContentId, state: ContentState): Observable<Result<void, Error>>;
  updateVisibility(
    id: ContentId,
    visibility: ContentVisibility
  ): Observable<Result<void, Error>>;
  addRelation(
    id: ContentId,
    relation: ContentRelationRef
  ): Observable<Result<void, Error>>;
  removeRelation(
    id: ContentId,
    kind: string,
    targetId: ContentId
  ): Observable<Result<void, Error>>;
}
