import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiLink, TuiIcon } from '@taiga-ui/core';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import {
  ApplicationContentStateComponent,
  readApplicationContent,
} from '@portals/shared/features/application-overview';
import {
  ApplicationDiscussionsComponent,
  ApplicationDiscussionPreviewsComponent,
  ApplicationDiscussionsService,
  provideApplicationDiscussions,
} from '@portals/shared/features/discussion';
import {
  buildRoutePath,
  type NavigationDeclarationDto,
} from '@portals/shared/boundary/navigation';
import { API_BASE_URL } from '../../environment';
import { NAVIGATION, NAVIGATION_NAME_PARAMS } from '../../navigation';

@Component({
  selector: 'app-application-discussions-api-page',
  standalone: true,
  imports: [
    RouterLink,
    TuiIcon, TuiButton,
    TuiLink,
    BreadcrumbsComponent,
    PageHeaderComponent,
    PageTitleComponent,
    ApplicationContentStateComponent,
    ApplicationDiscussionsComponent,
    ApplicationDiscussionPreviewsComponent,
  ],
  providers: [provideApplicationDiscussions(API_BASE_URL)],
  templateUrl: './application-discussions-api-page.component.html',
  styleUrl: './application-discussions-api-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationDiscussionsApiPageComponent {
  readonly appSlug = input<string>('');
  readonly discussionSlug = input<string | null>(null);
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly discussions = inject(ApplicationDiscussionsService);
  readonly app = readApplicationContent(this.appSlug);
  readonly application = this.app.application;
  readonly title = computed(() =>
    this.discussionSlug()
      ? this.application()
        ? this.discussions.items()[0]?.title ?? 'Discussion'
        : 'Discussion'
      : 'Community Discussions'
  );
  readonly breadcrumbs = computed(() =>
    this.breadcrumb().map((entry) => ({
      ...entry,
      path: buildRoutePath('/' + entry.path.replace(/^\/+/, ''), {
        appSlug: this.appSlug(),
        discussionSlug: this.discussionSlug() ?? '',
      }),
      label: entry.label
        .replace(
          NAVIGATION_NAME_PARAMS.applicationName,
          this.application()?.name ?? 'Application'
        )
        .replace(NAVIGATION_NAME_PARAMS.discussionName, this.title()),
    }))
  );
  readonly listLink = computed(() =>
    buildRoutePath('/' + NAVIGATION.applicationDiscussions.path, {
      appSlug: this.appSlug(),
    })
  );
  readonly overviewLink = computed(() =>
    buildRoutePath('/' + NAVIGATION.applicationOverview.path, {
      appSlug: this.appSlug(),
    })
  );
  readonly threadLink = (id: string) =>
    buildRoutePath('/' + NAVIGATION.applicationDiscussion.path, {
      appSlug: this.appSlug(),
      discussionSlug: id,
    });
  constructor() {
    effect(() => {
      const id = this.application()?.id ?? null,
        thread = this.discussionSlug();
      untracked(() => this.discussions.open(id, thread));
    });
  }
}
