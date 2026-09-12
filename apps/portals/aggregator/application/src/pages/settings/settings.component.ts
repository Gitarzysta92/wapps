import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { SETTINGS_NAVIGATION } from '../../navigation';

@Component({
  selector: 'settings-page',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiButton],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsPageComponent {
  readonly navigation = SETTINGS_NAVIGATION;
}
