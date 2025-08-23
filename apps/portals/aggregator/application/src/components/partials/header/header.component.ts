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
import { OutsideClickDirective } from '../../../libs/ui/directives/outside-click.directive';
import { NavigationService } from '../../../libs/aspects/navigation';
import { AuthenticationService } from '../../../libs/aspects/authentication/application';
import { GlobalStateService } from '../../../state/global-state.service';
import { MyProfileAvatarComponent } from '../../../libs/features/my-profile/presentation/containers/my-profile-avatar';
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
    MyProfileAvatarComponent,
    ApplicationsPanelComponent
  ]
})
export class HeaderPartialComponent {
  public readonly state = inject(GlobalStateService);
  public readonly authentication = inject(AuthenticationService);
  public readonly navigation = inject(NavigationService).config
}