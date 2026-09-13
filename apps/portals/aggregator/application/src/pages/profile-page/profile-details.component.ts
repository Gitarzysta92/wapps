import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { MediumCardComponent } from '@ui/layout';
import { CustomerProfileDto } from '@domains/customer/profiles';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { ProfileBadgesComponent } from '@portals/shared/features/user-profile';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { NAVIGATION } from '../../navigation';

/** Shared read-only profile details for the public directory and My Profile. */
@Component({
  selector: 'profile-details',
  standalone: true,
  templateUrl: './profile-details.component.html',
  styleUrl: './profile-details.component.scss',
  host: { class: 'profile-details' },
  imports: [RouterLink, TuiAppearance, TuiButton, TuiIcon, TuiAvatar, MediumCardComponent,
    ProfileBadgesComponent, PreferredDatePipe]
})
export class ProfileDetailsComponent {
  public readonly profile = input.required<CustomerProfileDto>();
  public readonly isLocalProfile = input(false);
  public readonly links = computed(() => this.socialLinks(this.profile()));
  public readonly stats = computed(() => {
    const stats = this.profile().stats;
    if (!stats) return [];
    return [
      { label: 'Discussions', value: stats.totalDiscussions },
      { label: 'Favorites', value: stats.totalFavorites },
      { label: 'Suites', value: stats.totalSuites },
      { label: 'Articles', value: stats.totalArticles }
    ];
  });
  public readonly editPath = buildRoutePath(NAVIGATION.settingsProfile.path, {}, { absolute: true });

  private socialLinks(profile: CustomerProfileDto | null): { label: string; url: string }[] {
    const result: { label: string; url: string }[] = [];
    for (const [key, raw] of Object.entries(profile?.socialLinks ?? {})) {
      if (!raw?.trim()) continue;
      let value = raw.trim();
      if (['twitter', 'github'].includes(key) && /^@?[a-zA-Z0-9_-]+$/.test(value)) {
        value = `https://${key === 'twitter' ? 'x.com' : 'github.com'}/${value.replace(/^@/, '')}`;
      }
      try {
        const url = new URL(value);
        if (['https:', 'http:'].includes(url.protocol)) result.push({ label: key === 'twitter' ? 'Twitter / X' : key.charAt(0).toUpperCase() + key.slice(1), url: url.href });
      } catch { /* Invalid local links are not presented as clickable destinations. */ }
    }
    return result;
  }
}
