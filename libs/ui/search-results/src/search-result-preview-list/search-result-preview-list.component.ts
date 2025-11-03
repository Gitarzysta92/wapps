import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
    TuiAvatar,
} from '@taiga-ui/kit';
import { TuiCell } from '@taiga-ui/layout';
import { SearchResultGroupVM } from '../search-result.vm';
import { TuiLink } from '@taiga-ui/core';
 

@Component({
  selector: "ul [search-result-preview-list]",
  standalone: true,
  imports: [
    FormsModule,
    TuiAvatar,
    TuiCell,
    RouterLink,
    TuiLink
  ],
  templateUrl: 'search-result-preview-list.component.html',
  styleUrl: 'search-result-preview-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'results-group'
  }
})
export class SearchResultPreviewList {
  public readonly result = input.required<SearchResultGroupVM[]>({ alias: 'search-result-preview-list' });
}
