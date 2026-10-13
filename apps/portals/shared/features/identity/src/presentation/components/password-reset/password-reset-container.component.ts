import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  TuiButton,
  TuiLoader,
  TuiNotification,
  TuiTextfield,
} from '@taiga-ui/core';
import { defer, finalize } from 'rxjs';
import { PASSWORD_RESET_HANDLER } from '../../../application/password-reset-handler.token';

@Component({
  selector: 'password-reset-container',
  imports: [
    ReactiveFormsModule,
    TuiButton,
    TuiLoader,
    TuiNotification,
    TuiTextfield,
  ],
  templateUrl: './password-reset-container.component.html',
  styleUrl: './password-reset-container.component.scss',
})
export class PasswordResetContainerComponent implements OnInit {
  @Input({ required: true }) code: string | null = null;
  private readonly service = inject(PASSWORD_RESET_HANDLER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(ChangeDetectorRef);
  public checking = false;
  public verified = false;
  public saving = false;
  public completed = false;
  public error: string | null = null;
  public readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(128),
      ],
    }),
    passwordConfirmation: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(128),
      ],
    }),
  });

  ngOnInit(): void {
    this.verify();
  }

  verify(): void {
    if (this.checking || this.saving || this.completed) return;
    const code = this.code;
    if (!code || !/^[A-Za-z0-9_-]{1,2048}$/.test(code)) {
      this.error =
        'This password reset link is incomplete or unsupported. Request a new link.';
      return;
    }
    this.checking = true;
    this.verified = false;
    this.error = null;
    defer(() => this.service.verifyCode(code))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.checking = false;
          this.changes.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.verified = result.ok;
          if (!result.ok) this.error = result.error.message;
          this.changes.markForCheck();
        },
        error: () => {
          this.error = 'The reset link could not be checked. Please retry.';
          this.changes.markForCheck();
        },
      });
  }

  submit(): void {
    if (this.saving || !this.verified || !this.code || this.completed) return;
    const input = this.form.getRawValue();
    if (this.form.invalid || input.password !== input.passwordConfirmation) {
      this.form.markAllAsTouched();
      this.error = 'Passwords must match and contain 6 to 128 characters.';
      return;
    }
    this.saving = true;
    this.error = null;
    const code = this.code;
    defer(() => this.service.resetPassword({ code, ...input }))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving = false;
          this.changes.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          if (result.ok && result.value) {
            this.completed = true;
            this.form.reset();
            this.code = null;
          } else
            this.error = result.ok
              ? 'Password reset was not confirmed. Try signing in or request a new link.'
              : result.error.message;
          this.changes.markForCheck();
        },
        error: () => {
          this.error =
            'Password reset was not confirmed. Try signing in with the new password, or request another link.';
          this.changes.markForCheck();
        },
      });
  }
}
