import type { Provider } from '@angular/core';
import {
  ARTICLE_COVERS,
  ARTICLE_COVERS_RECOVERY,
} from './application/article-cover.port';
import { ArticleCoverService } from './application/article-cover.service';
import { ArticleCoverApiService } from './infrastructure/article-cover-api.service';
import { ArticleCoverRecoveryService } from './infrastructure/article-cover-recovery.service';

/** Composed by lazy article pages so upload behavior stays outside the initial portal bundle. */
export function provideArticleCovers(): Provider[] {
  return [
    ArticleCoverService,
    { provide: ARTICLE_COVERS, useExisting: ArticleCoverApiService },
    {
      provide: ARTICLE_COVERS_RECOVERY,
      useExisting: ArticleCoverRecoveryService,
    },
  ];
}
