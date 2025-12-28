import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { NavigationListComponent, NavigationItemComponent } from '@ui/navigation';
import { TuiAvatar } from '@taiga-ui/kit';
import { DividerComponent } from '@ui/layout';

@Component({
  selector: 'common-sidebar',
  templateUrl: './common-sidebar.component.html',
  styleUrl: './common-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.expanded]': 'isExpanded()'
  },
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiIcon,
    TuiAvatar,
    TuiIconPipe,
    NavigationListComponent,
    NavigationItemComponent,
    DividerComponent,
  ]
})
export class CommonSidebarComponent {
  public readonly avatarPath = input<string | null>(null);
  public readonly isExpanded = input<boolean>(false);
  public readonly navigation = input<NavigationDeclarationDto[]>([]);
  public readonly navigationSecondary = input<NavigationDeclarationDto[]>([]);
  public readonly navigationAvatar = input<NavigationDeclarationDto | null>(null);
  public readonly alignment = input<'start' | 'end'>('end');
}
