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
import { NavigationService } from '@portals/shared/cross-cutting/navigation';
import { GlobalStateService } from '../../../state/global-state.service';
import { ApplicationsPanelComponent } from '../applications-panel/applications-panel.component';


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
  public readonly navigation = inject(NavigationService).config
}