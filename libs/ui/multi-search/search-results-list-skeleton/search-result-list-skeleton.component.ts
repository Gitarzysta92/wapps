import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TuiIcon, TuiLoader, TuiTitle} from '@taiga-ui/core';
import {
    TuiAvatar,
    TuiBadgeNotification,
    TuiCheckbox,
    TuiSensitive,
    TuiSkeleton,
    TuiTooltip,
} from '@taiga-ui/kit';
import {TuiCell} from '@taiga-ui/layout';
 
@Component({
  selector: "ul[search-result-list-skeleton]",
  standalone: true,
  imports: [
    FormsModule,
    TuiAvatar,
    TuiCell,
    TuiSkeleton,
  ],
  templateUrl: 'search-result-list-skeleton.component.html',
  styleUrl: 'search-result-list-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchResultListSkeleton {

}
