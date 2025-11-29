import { Component, ChangeDetectionStrategy} from '@angular/core';
import { TuiButton } from '@taiga-ui/core';

@Component({
  selector: 'a[navigationItem], button[navigationItem]',
  template: '<ng-content/>',
  styleUrl: './navigation-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  hostDirectives: [TuiButton],
  host: {
    'class': 'nav-item',
  }
})
export class NavigationItemComponent {}

