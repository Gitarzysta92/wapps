import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  buildRoutePath,
  IBreadcrumbRouteData,
  NavigationDeclarationDto,
  routingDataConsumerFrom,
} from '@portals/shared/boundary/navigation';
import { NAVIGATION } from '../../navigation';
import { LocalApplicationDraftsService } from './local-application-drafts.service';

@Component({
  selector: 'my-apps-page',
  standalone: true,
  templateUrl: './my-apps.component.html',
  styleUrl: './my-apps.component.scss',
  imports: [
    DatePipe,
    TuiButton,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAppsPageComponent
  implements routingDataConsumerFrom<IBreadcrumbRouteData>
{
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly store = inject(LocalApplicationDraftsService);
  private readonly router = inject(Router);
  readonly drafts = computed(() =>
    [...this.store.data().applications].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
  );
  readonly ownership = computed(() =>
    [...this.store.data().ownership].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
  );
  readonly pendingDelete = signal<string | null>(null);
  readonly message = signal('');
  constructor() {
    this.store.refresh();
  }
  editDraft(id?: string): void {
    void this.router.navigate(
      [buildRoutePath(NAVIGATION.registerApplication.path, {})],
      { queryParams: id ? { draftId: id } : {} }
    );
  }
  prepareOwnership(appSlug: string): void {
    void this.router.navigate([
      buildRoutePath(NAVIGATION.claimApplicationOwnership.path, { appSlug }),
    ]);
  }
  deleteDraft(id: string): void {
    if (this.store.removeApplication(id)) {
      this.pendingDelete.set(null);
      this.message.set(
        'Local application draft deleted. Separately saved ownership notes are retained.'
      );
    }
  }
  deleteOwnership(appSlug: string): void {
    if (this.store.removeOwnership(appSlug)) {
      this.pendingDelete.set(null);
      this.message.set('Local ownership notes deleted.');
    }
  }
}
