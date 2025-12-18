import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TuiBadge } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';



@Component({
  selector: 'article-details-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiIcon,
    DatePipe,
  ],
  hostDirectives: [
    { directive: TuiBadge, inputs: ['size'] },
  ],
  templateUrl: './article-details-badge.component.html',
  styleUrls: ['./article-details-badge.component.scss'],
  host: {
    '[class]': 'article-details'
  }
})
export class ArticleDetailsBadgeComponent {
  public readonly article = input.required<{ title: string; publicationDate: number }>();

}
