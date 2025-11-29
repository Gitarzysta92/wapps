import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'nav[navigationList], navigationList',
  template: '<ng-content/>',
  styleUrl: './navigation-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    'class': 'sidebar-nav',
    '[attr.data-alignment]': 'alignment()'
  }
})
export class NavigationListComponent {
  alignment = input<'start' | 'end'>('end');
}

