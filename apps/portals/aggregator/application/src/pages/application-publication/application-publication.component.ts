import { APPLICATION_WORKSPACE_PATHS } from '../../navigation';
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
import {
  ApplicationPublicationService,
  ApplicationImagePreviewComponent,
  type ApplicationPublicationView,
} from '@portals/shared/features/application-workspace';

@Component({
  selector: 'application-publication-page',
  standalone: true,
  imports: [
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
  templateUrl: './application-publication.component.html',
  styleUrl: '../application-drafts/application-drafts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationPublicationPageComponent {
  readonly workspacePaths = APPLICATION_WORKSPACE_PATHS;
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly publicationMode = input<
    ApplicationPublicationView,
    ApplicationPublicationView | undefined
  >('owner', { transform: (value) => value ?? 'owner' });
  readonly applicationId = input<string | undefined>();
  readonly page = input<string, string | undefined>('1', {
    transform: (value) => value ?? '1',
  });
  readonly publication = inject(ApplicationPublicationService);
  readonly imagePurposes = ['logo', 'banner'] as const;
  readonly reason = signal('');
  readonly confirmingWithdrawal = signal(false);
  private readonly router = inject(Router);
  constructor() {
    effect(() => {
      this.publication.sessionVersion();
      const mode = this.publicationMode();
      const id = this.applicationId() ?? '';
      const page = Number(this.page());
      untracked(() => {
        this.reason.set('');
        this.confirmingWithdrawal.set(false);
        this.publication.open(mode, id, page);
      });
    });
  }
  paginate(page: number) {
    void this.router.navigate(['/editorial/apps'], { queryParams: { page } });
  }
}
