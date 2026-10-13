import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, distinctUntilChanged, Subscription } from 'rxjs';
import { CredentialEmailStatus } from '@sdk/features/identity/libs/authentication';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { EMAIL_VERIFICATION } from './email-verification.port';

@Injectable()
export class EmailVerificationStatusService {
  private readonly provider = inject(EMAIL_VERIFICATION);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly destroyRef = inject(DestroyRef);
  readonly mode = this.provider.mode;
  readonly signedIn = signal(false);
  readonly status = signal<CredentialEmailStatus | null>(null);
  readonly busy = signal(false);
  readonly feedback = signal('');
  readonly error = signal(false);
  private operation?: Subscription;

  constructor() {
    this.session.token$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((token) => {
        this.operation?.unsubscribe();
        this.busy.set(false);
        this.status.set(null);
        this.feedback.set('');
        this.error.set(false);
        this.signedIn.set(!!token);
        this.refresh();
      });
    this.destroyRef.onDestroy(() => this.operation?.unsubscribe());
  }

  refresh(): void {
    if (this.busy() || !this.signedIn() || this.mode !== 'api') return;
    this.busy.set(true);
    this.status.set(null);
    this.feedback.set('');
    this.error.set(false);
    this.operation = defer(() => this.provider.status()).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result.ok) this.status.set(result.value);
        else this.fail(result.error.message);
      },
      error: () =>
        this.fail('Verification status is unavailable. Please refresh it.'),
    });
  }

  request(): void {
    const current = this.status();
    if (
      this.busy() ||
      !this.signedIn() ||
      this.mode !== 'api' ||
      !current?.email ||
      current.verified
    )
      return;
    this.busy.set(true);
    this.feedback.set('');
    this.error.set(false);
    this.operation = defer(() => this.provider.request()).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (!result.ok) this.fail(result.error.message);
        else if (result.value === 'already-verified') this.refresh();
        else
          this.feedback.set(
            'Verification email requested. Check your inbox and spam folder, then refresh your status after following the link.'
          );
      },
      error: () =>
        this.fail(
          'The request could not be confirmed. Check your inbox before trying again.'
        ),
    });
  }

  private fail(message: string): void {
    this.busy.set(false);
    this.error.set(true);
    this.feedback.set(message);
  }
}
