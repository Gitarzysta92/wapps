import { Component, computed, effect, inject, input } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { ProfileBadgeDisplayService } from '../../application/profile-badge-display.service';
import { ProfileBadgesComponent } from '../profile-badges/profile-badges.component';

@Component({
  selector: 'account-badges',
  standalone: true,
  templateUrl: './account-badges.component.html',
  styleUrl: './account-badges.component.scss',
  imports: [TuiButton, ProfileBadgesComponent, PreferredDatePipe],
  providers: [ProfileBadgeDisplayService],
})
export class AccountBadgesComponent {
  readonly profileId = input<string | null>(null);
  readonly badges = inject(ProfileBadgeDisplayService);
  readonly items = computed(
    () =>
      this.badges
        .value()
        ?.items.map((badge) => ({
          id: badge.kind,
          name: badge.kind === 'verified' ? 'Verified' : 'Premium',
          icon: badge.kind === 'verified' ? '@tui.badge-check' : '@tui.star',
          color: 'neutral',
          awardedAt: badge.awardedAt,
        })) ?? []
  );
  constructor() {
    effect(() => this.badges.open(this.profileId()));
  }
}
