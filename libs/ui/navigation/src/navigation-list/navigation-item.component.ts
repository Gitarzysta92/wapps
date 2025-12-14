import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { IsActiveMatchOptions } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';

@Component({
  selector: 'a[navigationItem], button[navigationItem]',
  template: '<ng-content/>',
  styleUrl: './navigation-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  hostDirectives: [
    TuiButton
  ],
  host: {
    'class': 'nav-item',
    '[attr.appearance]': 'appearance()',
  }
})
export class NavigationItemComponent {
  public readonly appearance = input<string>();
  public readonly activeClass = 'active';
  
  public getActiveOptions(path: string): IsActiveMatchOptions {
    return { 
      paths: path === '' ? 'exact' : 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored'
     };
  }
}

