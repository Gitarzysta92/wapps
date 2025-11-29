import { Component, Input, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, IsActiveMatchOptions } from '@angular/router';
import { TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { MyProfileAvatarComponent, MyProfileNameComponent } from '@ui/my-profile';
import { USER_PROFILE_COMMON_SIDEBAR_PROVIDER } from './user-profile-state-provider.token';
import { map } from 'rxjs';

@Component({
  selector: 'user-common-sidebar',
  templateUrl: './user-common-sidebar.component.html',
  styleUrl: './user-common-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.expanded]': 'isExpanded'
  },
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    TuiIconPipe,
    MyProfileAvatarComponent,
    MyProfileNameComponent
  ]
})
export class UserCommonSidebarComponent {

  @Input() isExpanded = false;
  @Input() navigation: NavigationDeclarationDto[] = [];

  private readonly profileStateProvider = inject(USER_PROFILE_COMMON_SIDEBAR_PROVIDER);

  public readonly profile$ = this.profileStateProvider.profile$.pipe(
    map(state => state.data)
  );

  public readonly isLoading$ = this.profileStateProvider.profile$.pipe(
    map(state => state.isLoading)
  );

  // TODO: excessive memory allocation,
  // by creating a new object for each call
  public getRouterLinkActiveOptions(path: string): IsActiveMatchOptions {
    return { 
      paths: path === '' ? 'exact' : 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored'
     };
  }
}

