import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize } from 'rxjs';
import { TuiButton, TuiLoader, TuiNotification } from '@taiga-ui/core';
import { PASSWORD_RESET_REQUEST_HANDLER } from '../../../application/password-reset-request-handler.token';
import {
  PasswordResetRequestForm,
  PasswordResetRequestFormDto,
} from '@ui/password-reset';

@Component({
  selector: 'password-reset-request-container',
  templateUrl: 'password-reset-request-container.component.html',
  styleUrl: 'password-reset-request-container.component.scss',
  standalone: true,
  imports: [TuiButton, TuiLoader, TuiNotification, PasswordResetRequestForm],
})
export class PasswordResetRequestContainerComponent {
  private readonly service = inject(PASSWORD_RESET_REQUEST_HANDLER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(ChangeDetectorRef);
  public isProcessing = false;
  public sent = false;
  public message: string | null = null;

  onFormSubmit(input: PasswordResetRequestFormDto): void {
    if (this.isProcessing || this.sent) return;
    this.isProcessing = true;
    this.message = null;
    defer(() => this.service.requestPasswordReset({ login: input.email }))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isProcessing = false;
          this.changes.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.sent = result.ok;
          this.message = result.ok
            ? 'If this email has an account, a password reset link will arrive shortly. Check your inbox and spam folder.'
            : result.error.message;
          this.changes.markForCheck();
        },
        error: () => {
          this.message =
            'Password recovery could not be requested. Please try again.';
          this.changes.markForCheck();
        },
      });
  }
}
