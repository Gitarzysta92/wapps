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
  ApplicationDraftsService,
  ApplicationMediaEditorComponent,
  ApplicationMediaRecoveryComponent,
  ApplicationMediaService,
} from '@portals/shared/features/application-workspace';
import type {
  ApplicationDraft,
  ApplicationDraftReceipt,
} from '@domains/catalog/record';
import type { Result } from '@sdk/kernel/standard';
import type { Observable } from 'rxjs';

@Component({
  selector: 'application-drafts-page',
  standalone: true,
  imports: [
    ApplicationMediaEditorComponent,
    ApplicationMediaRecoveryComponent,
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
  templateUrl: './application-drafts.component.html',
  styleUrl: './application-drafts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationDraftsPageComponent {
  readonly workspacePaths = APPLICATION_WORKSPACE_PATHS;
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly draftMode = input<'list' | 'edit', 'list' | 'edit' | undefined>(
    'list',
    { transform: (value) => value ?? 'list' }
  );
  readonly draftId = input<string | undefined>();
  readonly workspace = inject(ApplicationDraftsService);
  readonly media = inject(ApplicationMediaService);
  readonly pendingDelete = signal<ApplicationDraft | null>(null);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  constructor() {
    effect(() => {
      this.workspace.sessionVersion();
      const mode = this.draftMode();
      const id = this.draftId() ?? null;
      untracked(() => {
        this.pendingDelete.set(null);
        this.workspace.open(mode, id);
      });
    });
  }
  save() {
    this.finish(this.workspace.save());
  }
  retry() {
    this.finish(this.workspace.retry());
  }
  remove() {
    const draft = this.pendingDelete();
    if (draft) this.finish(this.workspace.remove(draft));
  }
  private finish(
    operation: Observable<Result<ApplicationDraftReceipt, Error>>
  ) {
    operation.pipe(takeUntilDestroyed(this.destroy)).subscribe((result) => {
      if (!result.ok) return;
      this.pendingDelete.set(null);
      if (result.value.deleted) {
        if (this.draftMode() === 'list') this.workspace.open('list');
        else void this.router.navigate(['/my/apps']);
      } else if (this.draftId() === result.value.id) {
        this.workspace.open('edit', result.value.id);
      } else {
        void this.router.navigate(['/apps/register'], {
          queryParams: { draftId: result.value.id },
          replaceUrl: true,
        });
      }
    });
  }
}
