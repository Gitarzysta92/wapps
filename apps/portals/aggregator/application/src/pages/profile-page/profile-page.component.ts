import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiAppearance, TuiIcon } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { TuiCardLarge } from '@taiga-ui/layout';
import { EXAMPLE_PROFILES } from '@portals/shared/data';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { PreferencesService } from '@portals/shared/features/preferences';
import { ProfileDetailsComponent } from './profile-details.component';
import { buildRoutePath, IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'profile-page',
  standalone: true,
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  imports: [RouterLink, TuiAppearance, TuiIcon, TuiAvatar, TuiCardLarge,
    ProfileDetailsComponent, BreadcrumbsComponent, PageHeaderComponent, PageTitleComponent]
})
export class ProfilePageComponent implements routingDataConsumerFrom<IBreadcrumbRouteData> {
  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  private readonly route = inject(ActivatedRoute);
  private readonly currentProfile = inject(MY_PROFILE_VIEW_STATE_PROVIDER, { optional: true });
  public readonly preferences = inject(PreferencesService);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  public readonly profiles = computed(() => {
    const local = this.currentProfile?.state();
    return EXAMPLE_PROFILES.map(profile => !local?.isError && local?.data?.id === profile.id ? local.data : profile);
  });
  public readonly profile = computed(() => this.profiles().find(profile => profile.id === this.params().get('profileId')) ?? null);
  public readonly title = computed(() => this.profile()?.name || 'Profile not found');
  public readonly breadcrumbs = computed<NavigationDeclarationDto[]>(() => [NAVIGATION.home, { icon: '@tui.user', label: this.title(), path: this.profilePath(this.params().get('profileId') ?? '') }]);
  public readonly isLocalProfile = computed(() => this.profile()?.id === this.currentProfile?.state().data?.id);
  public readonly otherProfiles = computed(() => this.profiles().filter(profile => profile.id !== this.profile()?.id));
  public profilePath(id: string): string {
    return buildRoutePath(NAVIGATION.userProfile.path, { profileId: id }, { absolute: true });
  }


}

export const profilePageComponent = ProfilePageComponent;
