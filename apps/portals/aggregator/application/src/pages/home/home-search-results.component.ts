import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { TuiButton } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import { MultiSearchPreviewState } from '@portals/shared/features/multi-search';
import {
  FullSearchRedirectComponent,
  SearchResultListSkeleton,
} from '@ui/search-results';

@Component({
  selector: 'home-search-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FullSearchRedirectComponent,
    TuiButton,
    SearchResultListSkeleton,
    TuiBadge,
    TuiAvatar,
  ],
  styleUrl: './home-search-results.component.scss',
  templateUrl: './home-search-results.component.html',
})
export class HomeSearchResultsComponent {
  protected groupQuery(
    query: Record<string, string>,
    type: string
  ): Record<string, string> {
    return { ...query, type: type.toLowerCase() };
  }

  @Input({ required: true }) state$!: Observable<MultiSearchPreviewState>;
  @Output() retry = new EventEmitter<void>();
}
