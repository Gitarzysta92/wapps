import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { DiscoverySearchResultDto } from './discovery-search-result.dto';

export interface IDiscoverySearchResultProvider {
  getSearchResults(): Observable<Result<DiscoverySearchResultDto[], Error>>;
  searchByQuery(
    query: string
  ): Observable<Result<DiscoverySearchResultDto[], Error>>;
}
