import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, timeout } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import { parseDigest } from '@domains/feed';
import { DIGEST_URL, type DigestPort } from '../application/digest.port';

@Injectable()
export class DigestApiService implements DigestPort {
  private readonly http = inject(HttpClient);
  private readonly url = inject(DIGEST_URL) + '/api/digest';
  read() {
    return this.http.get<unknown>(this.url).pipe(
      timeout(20_000),
      map((value) => ok(parseDigest(value))),
      catchError(() =>
        of(err(new Error('Digest could not be loaded. Please try again.')))
      )
    );
  }
}
