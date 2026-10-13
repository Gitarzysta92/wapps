import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
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
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import {
  SuitePublicationService,
  type SuitePublicationView,
} from '@portals/shared/features/suite';

@Component({
  selector: 'suite-publication-page',
  standalone: true,
  imports: [
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
  ],
  templateUrl: './suite-publication.component.html',
  styleUrl: '../private-suites/private-suites.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuitePublicationPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly suiteMode = input<
    SuitePublicationView,
    SuitePublicationView | undefined
  >('catalog', { transform: (value) => value ?? 'catalog' });
  readonly suiteId = input<string | undefined>();
  readonly suiteSlug = input<string | undefined>();
  readonly q = input<string, string | undefined>('', {
    transform: (value) => value ?? '',
  });
  readonly page = input<string, string | undefined>('1', {
    transform: (value) => value ?? '1',
  });
  readonly publication = inject(SuitePublicationService);
  readonly reason = signal('');
  readonly confirmingWithdrawal = signal(false);
  private readonly router = inject(Router);
  constructor() {
    effect(() => {
      this.publication.sessionVersion();
      const view = this.suiteMode();
      const id = this.suiteId() ?? this.suiteSlug() ?? '';
      const q = this.q();
      const page = Number(this.page());
      untracked(() => {
        this.reason.set('');
        this.confirmingWithdrawal.set(false);
        this.publication.open(view, id, q, page);
      });
    });
  }
  title() {
    return this.suiteMode() === 'owner'
      ? 'Publish your suite'
      : this.suiteMode() === 'review'
      ? 'Review suite'
      : this.suiteMode() === 'queue'
      ? 'Suite review queue'
      : this.suiteMode() === 'public'
      ? this.publication.detail()?.title ?? 'Suite'
      : 'Suites';
  }
  memberIds() {
    return this.suiteMode() === 'owner'
      ? this.publication.draft()?.applicationIds ?? []
      : this.suiteMode() === 'review'
      ? this.publication.status()?.latestSubmission?.applicationIds ?? []
      : this.publication.detail()?.applicationIds ?? [];
  }
  search(q: string) {
    void this.router.navigate(['/suites'], { queryParams: { q: q || null } });
  }
  paginate(page: number) {
    void this.router.navigate(
      [this.suiteMode() === 'queue' ? '/editorial/suites' : '/suites'],
      { queryParams: { q: this.q() || null, page } }
    );
  }
}
