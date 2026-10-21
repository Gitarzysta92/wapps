import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize } from 'rxjs';
import { TuiNotification, TuiButton, TuiLoader } from '@taiga-ui/core';
import { REGISTRATION_HANDLER } from '../../../application/registration-handler.token';
import { RegistrationFormComponent } from '@ui/registration';
import { RegistrationDto } from '@sdk/features/identity/libs/authentication';

@Component({
  selector: 'registration-container',
  templateUrl: './registration-container.component.html',
  imports: [RegistrationFormComponent, TuiNotification, TuiButton, TuiLoader],
})
export class RegistrationContainerComponent {
  private readonly service = inject(REGISTRATION_HANDLER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(ChangeDetectorRef);
  public isRegistering = false;
  public registered = false;
  public error: string | null = null;

  register(input: RegistrationDto): void {
    if (this.isRegistering || this.registered) return;
    this.isRegistering = true;
    this.error = null;
    defer(() => this.service.register(input))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isRegistering = false;
          this.changes.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          if (result.ok && result.value) this.registered = true;
          else
            this.error = result.ok
              ? 'Registration was not confirmed. Please sign in or try again.'
              : result.error.message;
          this.changes.markForCheck();
        },
        error: () => {
          this.error =
            'Registration could not be confirmed. Try signing in if an earlier attempt completed, or retry.';
          this.changes.markForCheck();
        },
      });
  }
}
