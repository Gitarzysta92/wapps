import { Component, inject } from '@angular/core';
import {
  TuiButton,
  TuiDropdown,
  TuiIcon,
} from '@taiga-ui/core';
import {
  TuiBadgedContent,
} from '@taiga-ui/kit';
import { UserPanelComponent } from '../user-panel/user-panel.component';
import { AsyncPipe } from '@angular/common';
import { GuestPanelComponent } from '../guest-panel/guest-panel.component';
import { OutsideClickDirective } from '@ui/misc';
import { GlobalStateService } from '../../state/global-state.service';
import { ApplicationsPanelComponent } from '../applications-panel/applications-panel.component';
import { BehaviorSubject } from 'rxjs';


@Component({
  selector: 'header',
  templateUrl: "header.component.html",
  styleUrl: 'header.component.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    TuiButton,
    TuiIcon,
    TuiDropdown,
    TuiBadgedContent,
    UserPanelComponent,
    GuestPanelComponent,
    OutsideClickDirective,
    ApplicationsPanelComponent
  ]
})
export class HeaderPartialComponent {
  public readonly state = inject(GlobalStateService);
  
  // Mock authentication service - replace with actual implementation
  public readonly authentication = {
    token$: new BehaviorSubject<string | null>(null)
  };

  // Navigation items - these should come from a proper navigation configuration
  public readonly navigationItems = {
    applications: { icon: 'app-window', label: 'Applications' },
    suites: { icon: 'package', label: 'Suites' },
    articles: { icon: 'file-text', label: 'Articles' }
  };
}