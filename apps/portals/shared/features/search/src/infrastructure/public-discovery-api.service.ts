import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, defer, map, of } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  parsePublicDiscovery,
  publicDiscoveryParameters,
  type PublicDiscoveryQuery,
} from '@domains/discovery';
import {
  PUBLIC_DISCOVERY_URL,
  type PublicDiscoveryPort,
} from '../application/public-discovery.port';

@Injectable()
export class PublicDiscoveryApiService implements PublicDiscoveryPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(PUBLIC_DISCOVERY_URL);
  search(query: PublicDiscoveryQuery) {
    return defer(() =>
      this.http.get<unknown>(this.origin + '/api/catalog/discover', {
        params: publicDiscoveryParameters(query),
      })
    ).pipe(
      map((value) => ok(parsePublicDiscovery(value, query))),
      catchError(() =>
        of(
          err(
            new Error('Discover is temporarily unavailable. Retry the search.')
          )
        )
      )
    );
  }
}
