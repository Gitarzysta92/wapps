import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { distinctUntilChanged, Subscription } from 'rxjs';
import type {
  ProfileBadgeAdministration,
  ProfileBadgeChange,
  ProfileBadgeKind,
} from '@domains/customer/profiles';
import {
  PROFILE_BADGES_PORT,
  PROFILE_BADGES_SESSION,
} from './profile-badges.port';

@Injectable()
export class ProfileBadgeAdminService {
  private readonly port = inject(PROFILE_BADGES_PORT);
  private readonly session = inject(PROFILE_BADGES_SESSION);
  readonly access = signal<'loading' | 'allowed' | 'denied' | 'unavailable'>(
    'loading'
  );
  readonly status = signal<
    'idle' | 'loading' | 'ready' | 'missing' | 'unavailable'
  >('idle');
  readonly profile = signal<ProfileBadgeAdministration | null>(null);
  readonly target = signal('');
  readonly reason = signal('');
  readonly saving = signal(false);
  readonly uncertain = signal(false);
  readonly conflict = signal(false);
  readonly feedback = signal('');
  readonly blocked = computed(() => this.saving() || this.uncertain());
  private capabilitySub = new Subscription();
  private readSub = new Subscription();
  private writeSub = new Subscription();
  private attempt: {
    id: string;
    command: ProfileBadgeChange;
    key: string;
    session: string;
  } | null = null;
  constructor() {
    const subscription = this.session.key$
      .pipe(distinctUntilChanged())
      .subscribe(() => {
        this.clear();
        this.checkAccess();
      });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      this.clear();
    });
  }
  checkAccess(): void {
    this.capabilitySub.unsubscribe();
    if (!this.session.currentKey()) {
      this.access.set('denied');
      return;
    }
    this.access.set('loading');
    this.capabilitySub = this.port
      .capabilities()
      .subscribe((result) =>
        this.access.set(
          result.ok
            ? 'allowed'
            : result.error.reason === 'denied'
            ? 'denied'
            : 'unavailable'
        )
      );
  }
  open(after: number | null = null): void {
    if (this.access() !== 'allowed' || this.blocked()) return;
    const id =
      after === null ? this.target().trim() : this.profile()?.profileId;
    if (!id) {
      this.feedback.set('Enter a public profile ID.');
      return;
    }
    this.read(id, after);
  }
  change(kind: ProfileBadgeKind, action: 'award' | 'revoke'): void {
    const profile = this.profile(),
      session = this.session.currentKey(),
      reason = this.reason().trim();
    if (
      !profile ||
      !session ||
      this.access() !== 'allowed' ||
      this.blocked() ||
      this.conflict()
    )
      return;
    if (reason.length < 3 || reason.length > 1000) {
      this.feedback.set('Provide a reason between 3 and 1,000 characters.');
      return;
    }
    this.attempt = {
      id: profile.profileId,
      command: { expectedRevision: profile.revision, kind, action, reason },
      key: crypto.randomUUID(),
      session,
    };
    this.send();
  }
  retry(): void {
    if (this.uncertain() && !this.saving()) this.send();
  }
  private read(id: string, after: number | null): void {
    this.readSub.unsubscribe();
    this.profile.set(null);
    this.status.set('loading');
    this.conflict.set(false);
    this.readSub = this.port.administer(id, after).subscribe((result) => {
      if (!result.ok) {
        this.status.set(
          result.error.reason === 'missing' ? 'missing' : 'unavailable'
        );
        if (result.error.reason === 'denied') this.access.set('denied');
        this.feedback.set(result.error.message);
        return;
      }
      this.profile.set(result.value);
      this.target.set(id);
      this.status.set('ready');
    });
  }
  private send(): void {
    const attempt = this.attempt;
    if (!attempt || attempt.session !== this.session.currentKey()) return;
    this.saving.set(true);
    this.feedback.set('Saving badge decision...');
    this.writeSub = this.port
      .change(attempt.id, attempt.command, attempt.key)
      .subscribe((result) => {
        if (
          attempt !== this.attempt ||
          attempt.session !== this.session.currentKey()
        )
          return;
        this.saving.set(false);
        if (!result.ok) {
          this.feedback.set(result.error.message);
          this.uncertain.set(result.error.reason === 'unavailable');
          this.conflict.set(result.error.reason === 'conflict');
          if (result.error.reason === 'denied') {
            this.profile.set(null);
            this.access.set('denied');
          }
          if (!this.uncertain()) this.attempt = null;
          return;
        }
        this.attempt = null;
        this.uncertain.set(false);
        this.reason.set('');
        this.feedback.set(
          `Badge decision saved at revision ${result.value.revision}.`
        );
        this.read(attempt.id, null);
      });
  }
  private clear(): void {
    this.capabilitySub.unsubscribe();
    this.readSub.unsubscribe();
    this.writeSub.unsubscribe();
    this.profile.set(null);
    this.target.set('');
    this.reason.set('');
    this.status.set('idle');
    this.attempt = null;
    this.saving.set(false);
    this.uncertain.set(false);
    this.conflict.set(false);
    this.feedback.set('');
  }
}
