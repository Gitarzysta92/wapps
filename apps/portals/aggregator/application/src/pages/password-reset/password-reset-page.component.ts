import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import {
  EmailVerificationActionComponent,
  PasswordResetContainerComponent,
} from '@portals/shared/features/identity';
import { RoutedDialogButton } from '@ui/routable-dialog';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';

@Component({
  templateUrl: './password-reset-page.component.html',
  styleUrl: './password-reset-page.component.scss',
  imports: [
    PasswordResetContainerComponent,
    EmailVerificationActionComponent,
    RouterLink,
    RoutedDialogButton,
    TuiButton,
    PageHeaderComponent,
    PageTitleComponent,
  ],
})
export class PasswordResetPageComponent {
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;
  readonly mode =
    this.params.getAll('mode').length === 1 &&
    ['resetPassword', 'verifyEmail'].includes(this.params.get('mode') ?? '') &&
    this.params.getAll('oobCode').length === 1
      ? this.params.get('mode')
      : null;
  readonly code = this.mode ? this.params.get('oobCode') : null;

  constructor() {
    // The one-time action code stays in memory, not browser history or subsequent referrers.
    inject(Location).replaceState('/auth/action');
  }
}
