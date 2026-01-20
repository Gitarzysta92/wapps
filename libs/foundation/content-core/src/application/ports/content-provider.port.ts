import type { Observable } from 'rxjs';
import type { Result } from '@standard';
import type { Content } from '../models/content.dto';
import type { ContentId } from '../models/content-id';
import type { ContentState, ContentVisibility } from '../constants';

export interface ContentProvider {
  getById(id: ContentId): Observable<Result<Content, Error>>;
  getByIds(ids: readonly ContentId[]): Observable<Result<Content[], Error>>;
  /** For post-search validation: resolve and filter by state/visibility. */
  getByIdsFiltered(
    ids: readonly ContentId[],
    options?: { state?: ContentState; visibility?: ContentVisibility }
  ): Observable<Result<Content[], Error>>;
}
