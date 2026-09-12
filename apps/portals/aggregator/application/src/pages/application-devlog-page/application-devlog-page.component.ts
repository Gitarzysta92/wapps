import { Component, computed, input, signal, effect } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { TuiButton, TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';
import { RouterLink } from '@angular/router';
import { RELEASES } from './releases';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import { 
  PageHeaderComponent, 
  PageTitleComponent, 
  PageTitleSkeletonComponent,
  PageMetaComponent,
  PageMetaSkeletonComponent,
  MediumCardComponent
} from '@ui/layout';
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS } from '@portals/shared/data';
import { NAVIGATION_NAME_PARAMS } from '../../navigation';

@Component({
  selector: 'app-application-devlog-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TuiButton,
    TuiIcon,
    TuiChip,
    TuiAppearance,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    PageMetaComponent,
    PageMetaSkeletonComponent,
    MediumCardComponent
  ],
  templateUrl: './application-devlog-page.component.html',
  styleUrl: './application-devlog-page.component.scss'
})
export class ApplicationDevlogPageComponent implements 
  routingDataConsumerFrom<IBreadcrumbRouteData & { appSlug: string | null }> {

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly appSlug = input<string | null>(null);

  public readonly app = rxResource({
    request: () => this.appSlug(),
    loader: ({ request: appSlug }) => {
      const app = APPLICATIONS.find(a => a.slug === appSlug) ?? null;
      return of(app);
    }
  });

  public readonly changelog = rxResource({
    request: () => this.appSlug(),
    loader: () => of(RELEASES)
  });

  public readonly breadcrumbData = computed(() => {
    const breadcrumb = this.breadcrumb().map(item => ({ ...item, path: '/' + item.path.replace(/^\/+/, '').replace(':appSlug', encodeURIComponent(this.appSlug() ?? '')) }));
    
    if (this.app.value()) { 
      return breadcrumb.map((b) => {
        if (b.label.includes(NAVIGATION_NAME_PARAMS.applicationName)) {
          return {
            ...b,
            label: b.label.replace(NAVIGATION_NAME_PARAMS.applicationName, this.app.value()?.name ?? 'Unknown Application')
          };
        }
        return b;
      });
    }
    return breadcrumb;
  });

  readonly version = input<string | null>(null);
  readonly stableLimit = signal(2);
  readonly stableEntries = computed(() => (this.changelog.value() ?? []).filter(entry => entry.channel === 'stable'));
  readonly visibleStableEntries = computed(() => this.stableEntries().slice(0, this.stableLimit()));
  readonly otherEntries = computed(() => (this.changelog.value() ?? []).filter(entry => entry.channel !== 'stable'));
  readonly selectedEntry = computed(() => (this.changelog.value() ?? []).find(entry => entry.version === this.version()));
  readonly previousEntries = computed(() => {
    const selected = this.selectedEntry();
    return selected ? (this.changelog.value() ?? []).filter(entry => entry.releaseDate < selected.releaseDate) : [];
  });
  readonly pageBreadcrumbs = computed(() => this.version()
    ? [...this.breadcrumbData(), {label: 'v' + this.version(), icon: '@tui.tag', path: this.releasePath(this.version()!)}]
    : this.breadcrumbData());

  constructor() {
    effect(() => { this.appSlug(); this.stableLimit.set(2); });
  }

  loadMore() { this.stableLimit.update(limit => limit + 2); }
  releasePath(version: string) { return `/apps/${this.appSlug()}/devlog/${version}`; }


}
