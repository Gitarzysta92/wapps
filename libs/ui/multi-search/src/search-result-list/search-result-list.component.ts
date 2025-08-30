import {ChangeDetectionStrategy, Component, input} from '@angular/core';
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
import { IMultiSearchResultGroup } from '../multi-search.interface';
 
@Component({
  selector: "ul [search-result-list]",
  standalone: true,
  imports: [
    FormsModule,
    TuiAvatar,
    TuiCell,
  ],
  templateUrl: 'search-result-list.component.html',
  styleUrl: 'search-result-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchResultList {
  public readonly result = input.required<IMultiSearchResultGroup[]>({ alias: 'search-result-list' });
}
