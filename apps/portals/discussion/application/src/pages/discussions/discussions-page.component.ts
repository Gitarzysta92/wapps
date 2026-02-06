import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TuiAppearance } from '@taiga-ui/core';
import {
  DiscussionMediumCardComponent,
  DiscussionSmallCardComponent,
} from '@portals/shared/features/discussion';
import { DISCUSSION_PREVIEW_DATA } from '@portals/shared/data';
import type { DiscussionPreviewDto } from '@domains/discussion';

@Component({
  selector: 'discussion-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiAppearance,
    DiscussionSmallCardComponent,
    DiscussionMediumCardComponent,
  ],
  templateUrl: './discussions-page.component.html',
  styleUrl: './discussions-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscussionsPageComponent {
  private readonly router = inject(Router);

  // For now use static preview data; swap to an API provider later.
  public readonly discussions = signal<DiscussionPreviewDto[]>(DISCUSSION_PREVIEW_DATA);

  public readonly stats = computed(() => {
    const list = this.discussions();
    return {
      topics: list.length,
      totalReplies: list.reduce((sum, d) => sum + (d.repliesCount ?? 0), 0),
      totalViews: list.reduce((sum, d) => sum + (d.viewsCount ?? 0), 0),
    };
  });

  public open(d: DiscussionPreviewDto): void {
    void this.router.navigate(['/discussions', d.slug]);
  }
}

