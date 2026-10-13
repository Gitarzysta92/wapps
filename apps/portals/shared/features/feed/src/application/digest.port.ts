import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { DigestContent } from '@domains/feed';

export interface DigestPort {
  read(): Observable<Result<DigestContent, Error>>;
}
export const DIGEST_PORT = new InjectionToken<DigestPort>('DIGEST_PORT');
export const DIGEST_URL = new InjectionToken<string>('DIGEST_URL');
