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
import { Router, RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  MediumCardComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import type { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { PrivateSuitesService } from '@portals/shared/features/suite';
import type { SuiteReceipt } from '@domains/publication/suite';
import type { Result } from '@sdk/kernel/standard';
import type { Observable } from 'rxjs';

@Component({
  selector: 'private-suites-page',
  standalone: true,
  imports: [
    FormsModule, TuiAvatar, TuiBadge,
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    BreadcrumbsComponent,
    ContentStateComponent,
  MediumCardComponent,
    PageHeaderComponent,
    PageTitleComponent,
  ],
  templateUrl: './private-suites.component.html',
  styleUrl: './private-suites.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateSuitesPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly suiteView = input<
    'list' | 'create' | 'detail',
    'list' | 'create' | 'detail' | undefined
  >('list', { transform: (value) => value ?? 'list' });
  readonly suiteId = input<string | undefined>();
  readonly workspace = inject(PrivateSuitesService);
  readonly editing = signal(false);
  readonly confirmingDelete = signal(false);
  readonly feedback = signal('');
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  constructor() {
    effect(() => {
      this.workspace.sessionVersion();
      const view = this.suiteView();
      const id = this.suiteId();
      untracked(() => {
        this.editing.set(view === 'create');
        this.confirmingDelete.set(false);
        this.feedback.set('');
        if (view === 'list') this.workspace.list();
        else {
          this.workspace.open(view === 'detail' ? id ?? null : null);
          if (view === 'create') this.workspace.search('');
        }
      });
    });
  }
  edit() {
    this.editing.set(true);
    this.feedback.set('');
    this.workspace.search('');
  }
  reload() {
    this.feedback.set('');
    this.confirmingDelete.set(false);
    if (this.suiteView() === 'list') this.workspace.list();
    else {
      this.editing.set(this.suiteView() === 'create');
      this.workspace.open(
        this.suiteView() === 'detail' ? this.suiteId() ?? null : null
      );
    }
  }
  save() {
    this.finish(this.workspace.save());
  }
  retry() {
    this.finish(this.workspace.retry());
  }
  remove() {
    this.finish(this.workspace.delete());
  }
  private finish(request: Observable<Result<SuiteReceipt, Error>>) {
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe((result) => {
      if (!result.ok) return;
      this.confirmingDelete.set(false);
      if (result.value.deleted) void this.router.navigate(['/my/suites']);
      else if (
        this.suiteView() === 'detail' &&
        result.value.id === this.suiteId()
      ) {
        this.editing.set(false);
        this.workspace.open(result.value.id);
        this.feedback.set('Suite saved.');
      } else void this.router.navigate(['/my/suites', result.value.id]);
    });
  }
}
