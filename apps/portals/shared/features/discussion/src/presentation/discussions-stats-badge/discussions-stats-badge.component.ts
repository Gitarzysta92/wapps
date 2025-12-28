import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of, delay } from 'rxjs';
import { TuiBadge, TuiSkeleton } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';

interface DiscussionStats {
  topics: number;
  totalReplies: number;
  totalViews: number;
}

@Component({
  selector: 'discussions-stats-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiIcon,
    TuiSkeleton,
  ],
  hostDirectives: [
    { directive: TuiBadge, inputs: ['size'] },
  ],
  templateUrl: './discussions-stats-badge.component.html',
  styleUrls: ['./discussions-stats-badge.component.scss'],
})
export class DiscussionsStatsBadgeComponent {
  public readonly appSlug = input<string | null>(null);
  public readonly appId = input<string | null>(null);

  public readonly stats = rxResource({
    request: () => ({ slug: this.appSlug(), id: this.appId() }),
    loader: ({ request }) => {
      // TODO: Replace with actual API call
      // For now, using mock data similar to the page component
      return of(this._generateMockStats(request.slug ?? request.id ?? 'unknown')).pipe(delay(800));
    }
  });

  private _generateMockStats(identifier: string): DiscussionStats {
    // Mock data - in production this would fetch from an API
    // The stats should represent aggregated data for all discussions
    // related to the given app slug/id
    return {
      topics: 5, // Total number of discussion topics
      totalReplies: 64, // Sum of all replies across all discussions
      totalViews: 869, // Sum of all views across all discussions
    };
  }
}

