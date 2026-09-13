import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { TuiCardLarge } from '@taiga-ui/layout';
import { MY_PROFILE_VIEW_STATE_PROVIDER, MyProfileService } from '@portals/shared/features/my-profile';
import { PageHeaderComponent, PageTitleComponent, ContentStateComponent } from '@ui/layout';
import { buildRoutePath, IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import { ProfileDetailsComponent } from '../profile-page/profile-details.component';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'my-profile-page',
  standalone: true,
  templateUrl: './my-profile-page.component.html',
  styleUrl: './my-profile-page.component.scss',
  imports: [ContentStateComponent, RouterLink, TuiAppearance, TuiButton, TuiCardLarge, TuiSkeleton, ProfileDetailsComponent,
    PageHeaderComponent, PageTitleComponent, BreadcrumbsComponent, BreadcrumbsSkeletonComponent]
})
export class MyProfilePageComponent implements routingDataConsumerFrom<IBreadcrumbRouteData> {
  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  private readonly profileService = inject(MyProfileService);
  public reload(): void { this.profileService.reload(); }
  private readonly myProfileStateProvider = inject(MY_PROFILE_VIEW_STATE_PROVIDER);
  public readonly profile = computed(() => this.myProfileStateProvider.state().data);
  public readonly isLoading = this.myProfileStateProvider.isLoading;
  public readonly isError = this.myProfileStateProvider.isError;
  public readonly publicPath = computed(() => buildRoutePath(NAVIGATION.userProfile.path, { profileId: this.profile()?.id ?? '' }, { absolute: true }));
  public readonly quickLinks = [NAVIGATION.settingsPreferences, NAVIGATION.settingsNotifications, NAVIGATION.settingsPrivacy]
    .map(link => ({ ...link, path: buildRoutePath(link.path, {}, { absolute: true }) }));
}
