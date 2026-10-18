import { APPLICATION_WORKSPACE_PATHS } from '../../navigation';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink, TuiTextfield, TuiLabel } from '@taiga-ui/core';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import type { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import {
  ApplicationOwnershipService,
  type OwnershipView,
} from '@portals/shared/features/application-workspace';
import type {
  OwnershipAction,
  OwnershipReceipt,
} from '@domains/catalog/ownership';
import type { Result } from '@sdk/kernel/standard';
import type { Observable } from 'rxjs';

@Component({
  selector: 'application-ownership-page',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    TuiTextfield, TuiLabel,
    TuiAppearance,
    TuiButton,
    TuiLink,
    BreadcrumbsComponent,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
  ],
  templateUrl: './application-ownership.component.html',
  styleUrl: '../application-drafts/application-drafts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationOwnershipPageComponent {
  readonly workspacePaths = APPLICATION_WORKSPACE_PATHS;
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly ownershipMode = input<OwnershipView, OwnershipView | undefined>(
    'list',
    { transform: (value) => value ?? 'list' }
  );
  readonly claimId = input<string | undefined>();
  readonly appSlug = input<string | undefined>();
  readonly page = input<string, string | undefined>('1', {
    transform: (value) => value ?? '1',
  });
  readonly ownership = inject(ApplicationOwnershipService);
  readonly evidenceUrl = signal('');
  readonly notes = signal('');
  readonly reason = signal('');
  readonly confirmation = signal<'release' | 'revoke' | 'cancel' | null>(null);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  constructor() {
    effect(() => {
      this.ownership.sessionVersion();
      const mode = this.ownershipMode(),
        id = this.claimId() ?? '',
        slug = this.appSlug() ?? '',
        page = Number(this.page());
      untracked(() => {
        this.evidenceUrl.set('');
        this.notes.set('');
        this.reason.set('');
        this.confirmation.set(null);
        this.ownership.open(mode, id, slug, page);
      });
    });
  }
  create() {
    this.finish(this.ownership.create(this.evidenceUrl(), this.notes()));
  }
  change(action: Exclude<OwnershipAction, 'create'>) {
    this.finish(this.ownership.change(action, this.reason()));
  }
  retry() {
    this.finish(this.ownership.retry());
  }
  paginate(page: number) {
    void this.router.navigate(
      [
        this.ownershipMode() === 'grants'
          ? '/' + this.workspacePaths.ownershipGrants
          : this.ownershipMode() === 'queue'
          ? '/' + this.workspacePaths.ownershipReview
          : '/' + this.workspacePaths.claims,
      ],
      { queryParams: { page } }
    );
  }
  private finish(operation: Observable<Result<OwnershipReceipt, Error>>) {
    operation.pipe(takeUntilDestroyed(this.destroy)).subscribe((result) => {
      if (!result.ok) return;
      this.confirmation.set(null);
      if (this.claimId() === result.value.id)
        this.ownership.open(
          this.ownershipMode(),
          result.value.id,
          '',
          Number(this.page()),
          true
        );
      else
        void this.router.navigate([
          ['approve', 'reject', 'revoke'].includes(result.value.action)
            ? '/' + this.workspacePaths.ownershipReview
            : '/' + this.workspacePaths.claims,
          result.value.id,
        ]);
    });
  }
}
