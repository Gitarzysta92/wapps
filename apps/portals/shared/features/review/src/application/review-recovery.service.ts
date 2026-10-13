import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import type { ReviewAttempt } from './reviews.port';

@Injectable({ providedIn: 'root' })
export class ReviewRecoveryService {
  readonly attempt = signal<ReviewAttempt | null>(null);
  constructor() {
    inject(AUTHENTICATION_SESSION)
      .token$.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.attempt.set(null));
  }
}
