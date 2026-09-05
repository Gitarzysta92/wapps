import { Component, computed, inject, input } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { ProfileBadgesComponent } from '@portals/shared/features/user-profile';
import { PageHeaderComponent, PageTitleComponent, PageTitleSkeletonComponent } from '@ui/layout';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';

@Component({
  selector: 'my-profile-page',
  templateUrl: 'my-profile-page.component.html',
  styleUrl: 'my-profile-page.component.scss',
  standalone: true,
  imports: [
    ProfileBadgesComponent,
    PageHeaderComponent,
    BreadcrumbsComponent,
    PageTitleSkeletonComponent,
    PageTitleComponent,
  ]
})
export class MyProfilePageComponent {

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);

  private readonly myProfileStateProvider = inject(MY_PROFILE_VIEW_STATE_PROVIDER);

  public readonly profile = computed(() => this.myProfileStateProvider.state().data);
  public readonly isLoading = this.myProfileStateProvider.isLoading;
  public readonly isError = this.myProfileStateProvider.isError;
}

