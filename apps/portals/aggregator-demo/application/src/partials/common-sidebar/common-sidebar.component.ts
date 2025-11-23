import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, IsActiveMatchOptions } from '@angular/router';
import { TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';

@Component({
  selector: 'common-sidebar',
  templateUrl: './common-sidebar.component.html',
  styleUrl: './common-sidebar.component.scss',
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
    TuiIconPipe
  ]
})
export class CommonSidebarPartialComponent {

  @Input() isExpanded = false;
  @Input() navigation: NavigationDeclarationDto[] = [];

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

  // public onToggleClick(): void {
  //   this.toggleExpansion.emit();
  // }
}
