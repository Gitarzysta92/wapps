import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
  TemplateRef,
} from '@angular/core';
import { DatePipe, SlicePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { ApplicationDiscussionsService } from '../application/application-discussions.service';

export interface ApplicationDiscussionPreviewContext {
  $implicit: ApplicationDiscussionPreviewsComponent;
}

@Component({
  selector: 'application-discussion-previews',
  standalone: true,
  imports: [DatePipe, SlicePipe, NgTemplateOutlet, RouterLink, TuiAppearance, TuiButton, TuiLink],
  providers: [ApplicationDiscussionsService],
  templateUrl: './application-discussion-previews.component.html',
  styleUrl: './application-discussion-previews.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationDiscussionPreviewsComponent {
  readonly applicationId = input.required<string>();
  readonly excludeId = input<string | null>(null);
  readonly refreshRevision = input(0);
  readonly threadLink = input.required<(id: string) => string>();
  readonly contentTemplate = input<TemplateRef<ApplicationDiscussionPreviewContext>>();
  readonly limit = input<2 | 3>(3);
  readonly context: ApplicationDiscussionPreviewContext = { $implicit: this };
  readonly discussions = inject(ApplicationDiscussionsService);
  readonly items = computed(() =>
    this.discussions
      .items()
      .filter((item) => item.id !== this.excludeId())
      .slice(0, this.limit())
  );
  private currentApplication: string | null = null;

  constructor() {
    effect(() => {
      const applicationId = this.applicationId();
      this.excludeId();
      this.refreshRevision();
      untracked(() => {
        if (this.currentApplication === applicationId) {
          this.discussions.reload(true);
        } else {
          this.currentApplication = applicationId;
          this.discussions.open(applicationId);
        }
      });
    });
  }
}
