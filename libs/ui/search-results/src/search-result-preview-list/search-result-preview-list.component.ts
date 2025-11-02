import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
    TuiAvatar,
} from '@taiga-ui/kit';
import { TuiCell } from '@taiga-ui/layout';
import { SearchResultGroupVM } from '../search-result.vm';
 

@Component({
  selector: "ul [search-result-preview-list]",
  standalone: true,
  imports: [
    FormsModule,
    TuiAvatar,
    TuiCell,
  ],
  templateUrl: 'search-result-preview-list.component.html',
  styleUrl: 'search-result-preview-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchResultPreviewList {
  public readonly result = input.required<SearchResultGroupVM[]>({ alias: 'search-result-preview-list' });
}
