import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import {
  ProfileBadgeAdminService,
  provideProfileBadges,
} from '@portals/shared/features/user-profile';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { API_BASE_URL } from '../../environment';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'profile-badge-admin',
  standalone: true,
  templateUrl: './profile-badge-admin.component.html',
  styleUrl: './profile-badge-admin.component.scss',
  providers: [provideProfileBadges(API_BASE_URL), ProfileBadgeAdminService],
  imports: [
    FormsModule,
    TuiAppearance,
    TuiButton,
    PreferredDatePipe,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
  ],
})
export class ProfileBadgeAdminComponent {
  readonly badges = inject(ProfileBadgeAdminService);
  readonly breadcrumbs = [
    NAVIGATION.home,
    NAVIGATION.myProfile,
    NAVIGATION.profileBadges,
  ];
  readonly kinds = ['verified', 'premium'] as const;
  active(kind: 'verified' | 'premium'): boolean {
    return (
      this.badges
        .profile()
        ?.badges.some((badge) => badge.kind === kind && badge.active) ?? false
    );
  }
}
