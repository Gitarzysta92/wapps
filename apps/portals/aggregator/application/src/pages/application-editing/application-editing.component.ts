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
  ApplicationEditingService,
  ApplicationMediaEditorComponent,
  ApplicationMediaRecoveryComponent,
  ApplicationMediaService,
  ApplicationImagePreviewComponent,
  type ApplicationEditingReceipt,
} from '@portals/shared/features/application-workspace';
import type { ApplicationDraftFields } from '@domains/catalog/record';
import type { Result } from '@sdk/kernel/standard';
import type { Observable } from 'rxjs';

@Component({
  selector: 'application-editing-page',
  standalone: true,
  imports: [
    ApplicationMediaEditorComponent,
    ApplicationMediaRecoveryComponent,
    ApplicationImagePreviewComponent,
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
  templateUrl: './application-editing.component.html',
  styleUrl: '../application-drafts/application-drafts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationEditingPageComponent {
  readonly workspacePaths = APPLICATION_WORKSPACE_PATHS;
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly applicationId = input('');
  readonly draftId = input<string | undefined>();
  readonly editing = inject(ApplicationEditingService);
  readonly media = inject(ApplicationMediaService);
  readonly imagePurposes = ['logo', 'banner'] as const;
  readonly confirmingMerge = signal(false);
  readonly fieldNames: readonly {
    key: keyof ApplicationDraftFields;
    label: string;
    max: number;
  }[] = [
    { key: 'name', label: 'Application name', max: 100 },
    { key: 'slug', label: 'Public slug', max: 80 },
    { key: 'website', label: 'Website', max: 2048 },
    { key: 'description', label: 'Description', max: 2000 },
  ];
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  constructor() {
    effect(() => {
      this.editing.sessionVersion();
      const id = this.applicationId(),
        draft = this.draftId() ?? null;
      untracked(() => {
        this.confirmingMerge.set(false);
        this.editing.open(id, draft);
      });
    });
  }
  save(merge = false) {
    this.finish(this.editing.save(merge));
  }
  retry() {
    this.finish(this.editing.retry());
  }
  private finish(
    operation: Observable<Result<ApplicationEditingReceipt, Error>>
  ) {
    operation.pipe(takeUntilDestroyed(this.destroy)).subscribe((result) => {
      if (!result.ok) return;
      this.confirmingMerge.set(false);
      if (
        this.applicationId() === result.value.applicationId &&
        this.draftId() === result.value.id
      )
        this.editing.open(result.value.applicationId, result.value.id, true);
      else
        void this.router.navigate(
          ['/' + this.workspacePaths.editing, result.value.applicationId],
          {
            queryParams: { draftId: result.value.id },
            replaceUrl: true,
          }
        );
    });
  }
}
