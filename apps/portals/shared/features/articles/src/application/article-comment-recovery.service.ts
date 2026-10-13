import { inject, Injectable, signal } from '@angular/core';
import { distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ARTICLE_SESSION } from './article-workspace.port';
import type { ArticleCommentAttempt } from './article-comments.port';

/** Private command content is retained only in this session's memory, across route changes. */
@Injectable({ providedIn: 'root' })
export class ArticleCommentRecoveryService {
  readonly attempt = signal<ArticleCommentAttempt | null>(null);
  constructor() {
    inject(ARTICLE_SESSION)
      .key$.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.attempt.set(null));
  }
}
