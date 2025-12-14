import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { ProfileAvatarComponent, ProfileNameComponent } from '@ui/profile';
import { NavigationListComponent, NavigationItemComponent } from '@ui/navigation';

@Component({
  selector: 'user-common-sidebar',
  templateUrl: './user-common-sidebar.component.html',
  styleUrl: './user-common-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.expanded]': 'isExpanded()'
  },
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiIcon,
    ProfileAvatarComponent,
    ProfileNameComponent,
    NavigationListComponent,
    NavigationItemComponent,
  ]
})
export class UserCommonSidebarComponent {

  isExpanded = input<boolean>(false);
  navigation = input<NavigationDeclarationDto[]>([]);

  private readonly myProfileViewStateProvider = inject(MY_PROFILE_VIEW_STATE_PROVIDER);
  public readonly userProfileAvatar = this.myProfileViewStateProvider.avatar();
  public readonly userProfileName = this.myProfileViewStateProvider.name();
   
}

