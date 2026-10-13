import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import { ReleaseCatalogService } from '@portals/shared/features/application-workspace';
import {
  ApplicationContentStateComponent,
  readApplicationContent,
} from '@portals/shared/features/application-overview';
import type { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import {
  APPLICATION_WORKSPACE_PATHS,
  NAVIGATION_NAME_PARAMS,
} from '../../navigation';

@Component({
  selector: 'app-release-devlog',
  standalone: true,
  imports: [
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    BreadcrumbsComponent,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
    ApplicationContentStateComponent,
  ],
  providers: [ReleaseCatalogService],
  templateUrl: './release-devlog.component.html',
  styleUrls: [
    '../application-drafts/application-drafts.component.scss',
    './release-devlog.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseDevlogPageComponent {
  readonly paths = APPLICATION_WORKSPACE_PATHS;
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly appSlug = input<string>('');
  readonly version = input<string>();
  readonly page = input<string>('1');
  readonly channel = input<string>('all');
  readonly pageNumber = computed(() => Number(this.page() ?? '1'));
  readonly catalog = inject(ReleaseCatalogService);
  readonly app = readApplicationContent(this.appSlug);
  readonly application = this.app.application;
  readonly breadcrumbs = computed(() =>
    this.breadcrumb().map((entry) => ({
      ...entry,
      path:
        '/' +
        entry.path
          .replace(/^\/+/, '')
          .replace(':appSlug', encodeURIComponent(this.appSlug())),
      label: entry.label.replace(
        NAVIGATION_NAME_PARAMS.applicationName,
        this.application()?.name ?? 'Application'
      ),
    }))
  );
  private readonly router = inject(Router);
  constructor() {
    effect(() => {
      const slug = this.application()?.slug,
        version = this.version() ?? null,
        page = this.pageNumber(),
        channel = this.channel() ?? 'all';
      untracked(() => {
        if (slug) this.catalog.open(slug, version, page, channel);
        else this.catalog.close();
      });
    });
  }
  reload() {
    const application = this.application();
    if (!application) {
      this.app.reload();
      return;
    }
    this.catalog.open(
      application.slug,
      this.version() ?? null,
      this.pageNumber(),
      this.channel() ?? 'all'
    );
  }
  paginate(page: number) {
    void this.router.navigate(
      this.version()
        ? ['/apps', this.appSlug(), 'devlog', this.version()]
        : ['/apps', this.appSlug(), 'devlog'],
      {
        queryParams: {
          page,
          ...(!this.version() && this.channel() !== 'all'
            ? { channel: this.channel() }
            : {}),
        },
      }
    );
  }
}
