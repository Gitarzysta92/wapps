import {
  Component,
  DestroyRef,
  inject,
  Input,
  OnChanges,
  signal,
} from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { defer, Subscription } from 'rxjs';
import { EMAIL_VERIFICATION } from '../../../application/email-verification.port';
import { provideEmailVerification } from '../../../email-verification.providers';

@Component({
  selector: 'email-verification-action',
  imports: [TuiButton],
  providers: [provideEmailVerification()],
  templateUrl: './email-verification-action.component.html',
  styleUrl: './email-verification.component.scss',
})
export class EmailVerificationActionComponent implements OnChanges {
  @Input({ required: true }) code: string | null = null;
  private readonly provider = inject(EMAIL_VERIFICATION);
  readonly busy = signal(false);
  readonly valid = signal(false);
  readonly completed = signal(false);
  readonly error = signal('');
  private operation?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.operation?.unsubscribe());
  }

  ngOnChanges(): void {
    this.operation?.unsubscribe();
    this.busy.set(false);
    this.valid.set(false);
    this.completed.set(false);
    this.check();
  }

  check(): void {
    if (this.busy() || this.completed()) return;
    const code = this.code;
    this.error.set('');
    this.valid.set(false);
    if (!code || !/^[A-Za-z0-9_-]{1,2048}$/.test(code)) {
      this.error.set(
        'This verification link is incomplete or unsupported. Request a new link in Profile Settings.'
      );
      return;
    }
    this.busy.set(true);
    this.operation = defer(() => this.provider.verify(code)).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result.ok) this.valid.set(true);
        else this.error.set(result.error.message);
      },
      error: () =>
        this.fail('This verification link could not be checked. Please retry.'),
    });
  }

  complete(): void {
    if (this.busy() || !this.valid() || !this.code || this.completed()) return;
    const code = this.code;
    this.busy.set(true);
    this.error.set('');
    this.operation = defer(() => this.provider.complete(code)).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result.ok) {
          this.completed.set(true);
          this.valid.set(false);
          this.code = null;
        } else this.fail(result.error.message);
      },
      error: () =>
        this.fail(
          'Verification could not be confirmed. Refresh your status in Profile Settings before trying again.'
        ),
    });
  }

  private fail(message: string): void {
    this.busy.set(false);
    this.valid.set(false);
    this.error.set(message);
  }
}
