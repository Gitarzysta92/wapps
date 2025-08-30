import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TuiIcon, TuiLoader, TuiTitle} from '@taiga-ui/core';
import {
    TuiAvatar,
    TuiBadgeNotification,
    TuiCheckbox,
    TuiSensitive,
    TuiTooltip,
} from '@taiga-ui/kit';
import {TuiCell} from '@taiga-ui/layout';
 
@Component({
  selector: "recent-search",
  standalone: true,
  imports: [
    FormsModule,
    TuiAvatar,
    TuiBadgeNotification,
    TuiCell,
    TuiCheckbox,
    TuiIcon,
    TuiLoader,
    TuiSensitive,
    TuiTitle,
    TuiTooltip,
  ],
  templateUrl: 'recent-search.component.html',
  styleUrl: 'recent-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecentSearchComponent {
  protected value = false;
}
