import { inject, Injectable, signal } from '@angular/core';
import { distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import type { ApplicationDiscussionAttempt } from './application-discussions.port';

/** Private command content is retained only in this session's memory, across route changes. */
@Injectable({ providedIn: 'root' })
export class ApplicationDiscussionRecoveryService {
  readonly attempt = signal<ApplicationDiscussionAttempt | null>(null);
  constructor() {
    inject(AUTHENTICATION_SESSION)
      .token$.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.attempt.set(null));
  }
}
