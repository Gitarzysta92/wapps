import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { distinctUntilChanged, Subscription } from 'rxjs';
import type { SharedProfileBadges } from '@domains/customer/profiles';
import {
  PROFILE_BADGES_PORT,
  PROFILE_BADGES_SESSION,
} from './profile-badges.port';

@Injectable()
export class ProfileBadgeDisplayService {
  private readonly port = inject(PROFILE_BADGES_PORT);
  private readonly session = inject(PROFILE_BADGES_SESSION);
  readonly value = signal<SharedProfileBadges | null>(null);
  readonly status = signal<'loading' | 'ready' | 'unavailable'>('loading');
  private id: string | null | undefined;
  private pending = new Subscription();
  constructor() {
    const session = this.session.key$
      .pipe(distinctUntilChanged())
      .subscribe(() => this.reload());
    inject(DestroyRef).onDestroy(() => {
      session.unsubscribe();
      this.pending.unsubscribe();
    });
  }
  open(id: string | null): void {
    this.id = id;
    this.reload();
  }
  reload(): void {
    this.pending.unsubscribe();
    this.value.set(null);
    this.status.set('loading');
    if (this.id === undefined) return;
    this.pending = this.port.read(this.id).subscribe((result) => {
      if (!result.ok) {
        this.status.set('unavailable');
        return;
      }
      this.value.set(result.value);
      this.status.set('ready');
    });
  }
}
