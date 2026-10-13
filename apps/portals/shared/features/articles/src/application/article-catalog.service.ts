import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  finalize,
  of,
  Subject,
  takeUntil,
  type Observable,
} from 'rxjs';
import { err, type Result } from '@sdk/kernel/standard';
import {
  parseArticleBrowseQuery,
  type ArticlePreview,
  type ArticlePage,
  type PublishedArticle,
} from '@domains/publication/article';
import { ARTICLE_CATALOG } from './article-workspace.port';
import { permitsContent } from '@domains/publication/classification';
import { PublicContentPreferencesService } from '@portals/shared/features/preferences';

@Injectable()
export class ArticleCatalogService {
  private readonly port = inject(ARTICLE_CATALOG);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private readonly preferences = inject(PublicContentPreferencesService);
  private current: { slug: string | null; input: unknown } | null = null;
  readonly loading = signal(false);
  readonly preferencesLoading = signal(false);
  readonly preferencesError = signal(false);
  readonly hidden = signal(false);
  readonly hiddenCount = signal(0);
  readonly error = signal('');
  readonly items = signal<ArticlePreview[]>([]);
  readonly article = signal<PublishedArticle | null>(null);
  readonly total = signal(0);

  constructor() {
    this.preferences.changes$.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.current) this.open(this.current.slug, this.current.input);
    });
  }

  retry() {
    if (this.preferencesError()) this.preferences.reload();
    else if (this.current) this.open(this.current.slug, this.current.input);
  }

  open(slug: string | null, input: unknown) {
    this.current = { slug, input };
    this.changed.next();
    this.items.set([]);
    this.article.set(null);
    this.total.set(0);
    this.error.set('');
    this.hidden.set(false);
    this.hiddenCount.set(0);
    const choice = this.preferences.state();
    this.preferencesLoading.set(choice.status === 'loading');
    this.preferencesError.set(choice.status === 'unavailable');
    this.loading.set(choice.status === 'loading');
    if (choice.status !== 'ready') return;
    this.loading.set(true);
    const source: Observable<Result<PublishedArticle | ArticlePage, Error>> =
      slug
        ? defer(() => this.port.find(slug))
        : defer(() => this.port.browse(parseArticleBrowseQuery(input)));
    source
      .pipe(
        catchError(() =>
          of(
            err(
              new Error(
                'Articles could not be loaded. Check the requested page and filters.'
              )
            )
          )
        ),
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (!result.ok) this.error.set(result.error.message);
        else if ('items' in result.value) {
          const items = result.value.items.filter((item) =>
            permitsContent(item, choice.showMatureContent)
          );
          this.items.set(items);
          this.hiddenCount.set(result.value.items.length - items.length);
          this.total.set(result.value.total);
        } else if (permitsContent(result.value, choice.showMatureContent))
          this.article.set(result.value);
        else this.hidden.set(true);
      });
  }
}
