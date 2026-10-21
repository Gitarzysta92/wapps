import { Component, inject } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { EmailVerificationStatusService } from '../../../application/email-verification-status.service';
import { provideEmailVerification } from '../../../email-verification.providers';

@Component({
  selector: 'email-verification-status',
  imports: [TuiButton],
  providers: [...provideEmailVerification(), EmailVerificationStatusService],
  templateUrl: './email-verification-status.component.html',
  styleUrl: './email-verification.component.scss',
})
export class EmailVerificationStatusComponent {
  readonly verification = inject(EmailVerificationStatusService);
}
