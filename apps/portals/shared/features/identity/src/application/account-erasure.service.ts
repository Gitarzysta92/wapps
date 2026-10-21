import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  Subscription,
  defer,
  distinctUntilChanged,
  first,
  finalize,
} from 'rxjs';
import { ACCOUNT_ERASURE, type ErasureAccount } from './account-erasure.port';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { AUTHENTICATION_RECOVERY_CONTROL } from './authentication-recovery-control';

/** Root-scoped so an authorized request and its outcome survive privacy-page navigation. */
@Injectable({ providedIn: 'root' })
export class AccountErasureService {
  private readonly port = inject(ACCOUNT_ERASURE);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly recovery = inject(AUTHENTICATION_RECOVERY_CONTROL);
  private operation = new Subscription();
  private generation = 0;
  private closingSession = false;
  readonly signedIn = signal(false);
  readonly state = signal<
    | 'idle'
    | 'checking'
    | 'confirming'
    | 'submitting'
    | 'accepted'
    | 'uncertain'
    | 'error'
  >('idle');
  readonly account = signal<ErasureAccount | null>(null);
  readonly feedback = signal('');
  readonly terminal = computed(() =>
    ['accepted', 'uncertain'].includes(this.state())
  );
  readonly busy = computed(() =>
    ['checking', 'submitting'].includes(this.state())
  );

  constructor() {
    const subscription = this.session.token$
      .pipe(distinctUntilChanged())
      .subscribe((token) => {
        this.signedIn.set(!!token);
        if (token === null && this.closingSession) return;
        this.reset();
      });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      this.reset();
    });
  }
  begin(): void {
    if (!this.signedIn() || !['idle', 'error'].includes(this.state())) return;
    const token = this.session.getToken(),
      generation = this.generation;
    this.state.set('checking');
    this.feedback.set('');
    this.operation = defer(() => this.port.prepare())
      .pipe(first())
      .subscribe({
        next: (result) => {
          if (!this.current(token, generation)) return;
          if (result.ok) {
            this.account.set(result.value);
            this.state.set('confirming');
          } else this.preparationFailed();
        },
        error: () => {
          if (this.current(token, generation)) this.preparationFailed();
        },
      });
  }
  cancel(): void {
    if (['checking', 'confirming', 'error'].includes(this.state()))
      this.reset();
  }
  confirm(confirmation: string, understood: boolean): void {
    const account = this.account();
    if (
      this.state() !== 'confirming' ||
      !account ||
      confirmation !== 'DELETE' ||
      understood !== true ||
      !this.signedIn()
    )
      return;
    const token = this.session.getToken(),
      generation = this.generation;
    if (!token) return;
    this.state.set('submitting');
    const hold = { token };
    this.recovery.hold = hold;
    const release = () => {
      if (this.recovery.hold === hold) this.recovery.hold = null;
    };
    this.operation = defer(() => this.port.request(account.identityId))
      .pipe(first(), finalize(release))
      .subscribe({
        next: (result) => {
          if (!this.current(token, generation)) return;
          if (!result.ok || result.value.identityId !== account.identityId) {
            this.unconfirmed(token);
            return;
          }
          this.state.set('accepted');
          this.feedback.set(
            result.value.cleanup === 'completed'
              ? 'Your account is closed and cleanup is complete. Public contributions remain with anonymous attribution.'
              : result.value.cleanup === 'failed'
              ? 'Your account is closed, but cleanup needs operator attention. Cleanup is not complete.'
              : 'Deletion accepted. Your account is closed. Private data cleanup is pending. Public contributions remain with anonymous attribution.'
          );
          this.closeSession(token);
        },
        error: () => {
          if (this.current(token, generation)) this.unconfirmed(token);
        },
      });
  }
  private current(token: string | null, generation: number): boolean {
    return (
      !!token &&
      generation === this.generation &&
      this.session.getToken() === token
    );
  }
  private preparationFailed(): void {
    this.state.set('error');
    this.feedback.set(
      'Your current account could not be verified. No deletion request was sent. Check your connection and sign-in, then try again.'
    );
  }
  private unconfirmed(token: string | null): void {
    this.state.set('uncertain');
    this.feedback.set(
      'The deletion request could not be confirmed. It may already have closed your account. No automatic retry was sent. Sign in again to check whether your account is still available.'
    );
    this.closeSession(token);
  }
  private closeSession(token: string | null): void {
    this.account.set(null);
    if (this.session.getToken() !== token) return;
    this.closingSession = true;
    try {
      this.session.clear();
      this.feedback.update(
        (message) => message + ' This browser is signed out.'
      );
    } catch {
      this.feedback.update(
        (message) =>
          message +
          ' Browser sign-out could not be completed. Close this browser session.'
      );
    } finally {
      this.closingSession = false;
    }
  }
  private reset(): void {
    this.generation++;
    this.operation.unsubscribe();
    this.account.set(null);
    this.feedback.set('');
    this.state.set('idle');
  }
}
