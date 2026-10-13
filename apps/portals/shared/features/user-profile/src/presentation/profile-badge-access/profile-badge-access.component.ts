import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { ProfileBadgeAdminService } from '../../application/profile-badge-admin.service';

@Component({
  selector: 'profile-badge-access',
  standalone: true,
  imports: [RouterLink, TuiButton],
  providers: [ProfileBadgeAdminService],
  template: `@if (badges.access() === 'allowed') {
    <a tuiButton appearance="secondary" size="m" [routerLink]="path()"
      >Manage profile badges</a
    >
    } @else if (badges.access() === 'unavailable') {
    <button
      tuiButton
      appearance="secondary"
      size="m"
      type="button"
      (click)="badges.checkAccess()"
    >
      Retry staff access check
    </button>
    }`,
})
export class ProfileBadgeAccessComponent {
  readonly path = input.required<string>();
  readonly badges = inject(ProfileBadgeAdminService);
}
