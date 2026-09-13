import { ContentStateComponent } from '@ui/layout';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TuiButton, TuiLink } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { ArticleDetail, EntryDetailsDataService, SuiteDetail } from './entry-details-data.service';

type DetailState =
  | { kind: 'article'; article: ArticleDetail }
  | { kind: 'suite'; suite: SuiteDetail }
  | { kind: 'create' }
  | { kind: 'missing'; label: string; back: string };

@Component({
  selector: 'entry-details-page',
  standalone: true,
  imports: [ContentStateComponent, AsyncPipe, DatePipe, RouterLink, ReactiveFormsModule, TuiButton, TuiLink, TuiAvatar, TuiBadge, FavoriteToggleButtonComponent],
  templateUrl: './entry-details-page.component.html',
  styleUrl: './entry-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = inject(EntryDetailsDataService);
  readonly selectedApps = signal<string[]>([]);
  readonly error = signal('');
  readonly savedSuite = signal<SuiteDetail | null>(null);
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });
  readonly state$ = this.route.paramMap.pipe(map((params): DetailState => {
    const articleSlug = params.get('articleSlug');
    const suiteSlug = params.get('suiteSlug');
    if (articleSlug !== null) {
      const article = this.data.article(articleSlug);
      return article ? { kind: 'article', article } : { kind: 'missing', label: 'Article', back: '/articles' };
    }
    if (this.route.snapshot.routeConfig?.path === 'suites/create' || suiteSlug === 'create') return { kind: 'create' };
    if (suiteSlug !== null) {
      const suite = this.data.suite(suiteSlug);
      return suite ? { kind: 'suite', suite } : { kind: 'missing', label: 'Suite', back: '/suites' };
    }
    return { kind: 'missing', label: 'Content', back: '/' };
  }));

  toggleApp(slug: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedApps.update(apps => checked ? [...new Set([...apps, slug])] : apps.filter(app => app !== slug));
    this.error.set('');
  }

  async saveSuite(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.selectedApps().length) {
      this.error.set('Enter a title of up to 100 characters and select at least one application.');
      return;
    }
    this.error.set('');
    try {
      const { title, description } = this.form.getRawValue();
      const suite = this.data.createSuite(title, description, this.selectedApps());
      this.savedSuite.set(suite);
      if (!await this.router.navigate(['/suites', suite.slug])) {
        this.error.set('Your draft was saved. Use the link below to open it.');
      }
    } catch {
      this.error.set(this.savedSuite() ? 'Your draft was saved, but could not be opened. Use the link below.' : 'Could not save your draft. Check that browser storage is available and try again.');
    }
  }
}
