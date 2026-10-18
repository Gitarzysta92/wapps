import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, startWith } from 'rxjs';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import type { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import {
  ArticleCatalogService,
  ArticleCoverImageComponent,
  ArticleCommentsComponent,
  provideArticleCovers,
} from '@portals/shared/features/articles';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { APPLICATION_WORKSPACE_PATHS } from '../../navigation';
import { TuiBadge } from '@taiga-ui/kit';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'app-article-catalog',
  standalone: true,
  imports: [
    ArticleCoverImageComponent,
    ArticleCommentsComponent,
    DatePipe,
    FormsModule,
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    BreadcrumbsComponent,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
    FavoriteToggleButtonComponent,
    TuiBadge,
    ResultsPageComponent,
  ],
  providers: [ArticleCatalogService, provideArticleCovers()],
  templateUrl: './article-catalog.component.html',
  styleUrls: [
    '../entry-details-page/entry-details-page.component.scss',
    './article-reading.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleCatalogPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly paths = APPLICATION_WORKSPACE_PATHS;
  readonly catalog = inject(ArticleCatalogService);
  readonly q = signal('');
  readonly category = signal('');
  readonly tag = signal('');
  readonly page = signal(1);
  readonly slug = signal<string | null>(null);
  readonly thread = signal<string | null>(null);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed()
      )
      .subscribe(() => this.reload());
  }
  reload() {
    let route = this.route.snapshot;
    while (route.firstChild) route = route.firstChild;
    const query = route.queryParamMap;
    const threads = query.getAll('thread');
    this.thread.set(threads.length > 1 ? 'invalid' : threads[0] ?? null);
    this.q.set(query.get('q') ?? '');
    this.category.set(
      query.get('category') ?? route.paramMap.get('category') ?? ''
    );
    this.tag.set(query.get('tag') ?? '');
    this.page.set(
      Number(query.get('page') ?? route.paramMap.get('page') ?? '1')
    );
    this.slug.set(this.route.snapshot.paramMap.get('articleSlug'));
    this.catalog.open(this.slug(), {
      q: this.q(),
      category: this.category(),
      tag: this.tag(),
      page: String(this.page()),
    });
  }
  browse(page = 1) {
    void this.router.navigate(['/articles'], {
      queryParams: {
        page,
        q: this.q().trim() || null,
        category: this.category().trim() || null,
        tag: this.tag().trim() || null,
      },
    });
  }
}
