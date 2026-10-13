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
  ReleaseWorkspaceService,
  type ReleaseWorkspaceView,
  type ReleaseChangeReceipt,
} from '@portals/shared/features/application-workspace';
import { APPLICATION_WORKSPACE_PATHS } from '../../navigation';

@Component({
  selector: 'app-release-workspace',
  standalone: true,
  imports: [
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
  templateUrl: './release-workspace.component.html',
  styleUrl: '../application-drafts/application-drafts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseWorkspacePageComponent {
  readonly paths = APPLICATION_WORKSPACE_PATHS;
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly releaseMode = input<ReleaseWorkspaceView>('list');
  readonly draftId = input<string>();
  readonly applicationId = input<string>();
  readonly releaseId = input<string>();
  readonly page = input<string>('1');
  readonly workspace = inject(ReleaseWorkspaceService);
  readonly reason = signal('');
  readonly confirmation = signal<
    'delete' | 'withdraw' | 'rebase' | 'reload' | null
  >(null);
  readonly textFields = [
    { key: 'version', label: 'Version', max: 80, type: 'text' },
    { key: 'releasedOn', label: 'Release date', max: 10, type: 'date' },
    { key: 'title', label: 'Title', max: 160, type: 'text' },
  ] as const;
  readonly mergeFields = [
    { key: 'version', label: 'Version' },
    { key: 'channel', label: 'Channel' },
    { key: 'type', label: 'Release type' },
    { key: 'releasedOn', label: 'Release date' },
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'changes', label: 'Changes' },
  ] as const;
  private readonly router = inject(Router);
  constructor() {
    effect(() => {
      this.workspace.sessionVersion();
      const location = {
        view: this.releaseMode(),
        id: this.draftId(),
        applicationId: this.applicationId(),
        releaseId: this.releaseId(),
        page: Number(this.page() ?? '1'),
      };
      untracked(() => {
        this.reason.set('');
        this.confirmation.set(null);
        this.workspace.open(location);
      });
    });
  }
  hasSavedDraft(receipt: ReleaseChangeReceipt) {
    return !('deleted' in receipt && receipt.deleted);
  }
  receiptPath(receipt: ReleaseChangeReceipt) {
    const reviewing =
      'action' in receipt &&
      (receipt.action === 'approve' || receipt.action === 'reject');
    return [
      '/' + (reviewing ? this.paths.releaseReviews : this.paths.releases),
      receipt.id,
    ];
  }
  confirm() {
    const action = this.confirmation();
    this.confirmation.set(null);
    if (action === 'delete') this.workspace.remove();
    else if (action === 'withdraw') this.workspace.publish('withdraw');
    else if (action === 'rebase') this.workspace.rebase();
    else if (action === 'reload') this.workspace.reload();
  }
  paginate(page: number) {
    void this.router.navigate(['/' + this.paths.releaseReviews], {
      queryParams: { page },
    });
  }
}
