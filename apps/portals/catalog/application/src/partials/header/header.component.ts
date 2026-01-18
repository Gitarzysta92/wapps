import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';
import { NAVIGATION, MAIN_NAVIGATION } from '../../navigation';

@Component({
  selector: 'catalog-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiIcon,
  ]
})
export class HeaderPartialComponent {
  public readonly navigation = MAIN_NAVIGATION;
  public readonly homeNavigation = NAVIGATION.home;
}
