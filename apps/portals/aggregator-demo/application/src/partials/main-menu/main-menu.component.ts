import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

export interface NavigationItem {
  id: number;
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'main-menu',
  standalone: true,
  imports: [CommonModule, RouterModule, TuiButton, TuiIcon],
  templateUrl: './main-menu.component.html',
  styleUrl: './main-menu.component.scss'
})
export class MainMenuComponent {
  @Input() navigationItems: NavigationItem[] = [];
}
