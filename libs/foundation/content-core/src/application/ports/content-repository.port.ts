import type { Observable } from 'rxjs';
import type { Result } from '@foundation/standard';
import type { Content } from '../models/content.dto';
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
}
