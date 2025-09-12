import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TuiIcon, TuiTitle} from '@taiga-ui/core';
import {
    TuiBadgeNotification,
} from '@taiga-ui/kit';
import {TuiCell} from '@taiga-ui/layout';
 
@Component({
  selector: "a[full-search-redirect]",
  standalone: true,
  hostDirectives: [
    TuiCell
  ],
  imports: [
    FormsModule,
    TuiBadgeNotification,
    TuiTitle,
    TuiIcon
  ],
  templateUrl: 'full-search-redirect.component.html',
  styleUrl: 'full-search-redirect.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FullSearchRedirectComponent {
  public readonly resultsNumber = input<number | null>(null, { alias: 'full-search-redirect' });
}
