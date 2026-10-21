import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import type { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import {
  ArticleWorkspaceService,
  ArticleCoverEditorComponent,
  ArticleCoverImageComponent,
  provideArticleCovers,
  type ArticleWorkspaceView,
  type ArticleChangeReceipt,
} from '@portals/shared/features/articles';
import { APPLICATION_WORKSPACE_PATHS } from '../../navigation';

@Component({
  selector: 'app-article-workspace',
  standalone: true,
  providers: [provideArticleCovers()],
  imports: [
    ArticleCoverEditorComponent,
    ArticleCoverImageComponent,
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
  ],
  templateUrl: './article-workspace.component.html',
  styleUrls: [
    '../application-drafts/application-drafts.component.scss',
    './article-reading.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleWorkspacePageComponent {
  readonly paths = APPLICATION_WORKSPACE_PATHS;
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly articleMode = input<ArticleWorkspaceView>('list');
  readonly draftId = input<string>();
  readonly page = input<string>('1');
  readonly workspace = inject(ArticleWorkspaceService);
  readonly reason = signal('');
  readonly confirmation = signal<'delete' | 'withdraw' | 'reload' | null>(null);
  readonly textFields = [
    { key: 'title', label: 'Title', max: 160 },
    { key: 'slug', label: 'Article URL name', max: 100 },
    { key: 'byline', label: 'Public byline', max: 100 },
    { key: 'category', label: 'Category', max: 80 },
  ] as const;
  private readonly router = inject(Router);
  constructor() {
    effect(() => {
      this.workspace.sessionVersion();
      const location = {
        view: this.articleMode(),
        id: this.draftId(),
        page: Number(this.page() ?? '1'),
      };
      untracked(() => {
        this.reason.set('');
        this.confirmation.set(null);
        this.workspace.open(location);
      });
    });
  }
  receiptPath(receipt: ArticleChangeReceipt) {
    const review =
      'action' in receipt &&
      (receipt.action === 'approve' || receipt.action === 'reject');
    return [
      '/' + (review ? this.paths.articleReviews : this.paths.articles),
      receipt.id,
    ];
  }
  hasSavedDraft(receipt: ArticleChangeReceipt) {
    return !('deleted' in receipt && receipt.deleted);
  }
  confirm() {
    const action = this.confirmation();
    this.confirmation.set(null);
    if (action === 'delete') this.workspace.remove();
    else if (action === 'withdraw') this.workspace.publish('withdraw');
    else if (action === 'reload') this.workspace.reload();
  }
  paginate(page: number) {
    void this.router.navigate(['/' + this.paths.articleReviews], {
      queryParams: { page },
    });
  }
}
