import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { CommonSidebarComponent } from '../common-sidebar/common-sidebar.component';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from '@portals/shared/features/my-profile';

@Component({
  selector: 'user-common-sidebar',
  template: `
    <common-sidebar
      [avatarPath]="avatarPath()"
      [isExpanded]="isExpanded()"
      [navigation]="navigation()"
      [alignment]="alignment()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonSidebarComponent]
})
export class UserCommonSidebarComponent {
  public readonly isExpanded = input<boolean>(false);
  public readonly navigation = input<NavigationDeclarationDto[]>([]);
  public readonly alignment = input<'start' | 'end'>('end');

  private readonly myProfileViewState = inject(MY_PROFILE_VIEW_STATE_PROVIDER);
  
  protected readonly avatarPath = this.myProfileViewState.avatar;
}
