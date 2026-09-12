import { Component, inject, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { AppRecordDto } from '@domains/catalog/record';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import { 
  PageHeaderComponent, 
  PageTitleComponent, 
  PageTitleSkeletonComponent,
  PageMetaComponent,
  PageMetaSkeletonComponent,
  MediumCardComponent,
  MediumCardSkeletonComponent
} from '@ui/layout';
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS } from '@portals/shared/data';
import { NAVIGATION_NAME_PARAMS } from '../../navigation';
import { 
  StatusBannerComponent, 
  NoticesSectionComponent,
  HealthCheckBadgeComponent,
  StatusHistoryComponent,
  type ServiceStatus, 
  type Notice 
} from '@apps/portals/shared/features/health-status';
import { ApplicationHealthStatusCode } from '@domains/feed';

@Component({
  selector: 'app-application-health-page',
  standalone: true,
  imports: [
    CommonModule,
    TuiIcon,
    TuiBadge,
    TuiAppearance,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    PageMetaComponent,
    PageMetaSkeletonComponent,
    MediumCardComponent,
    MediumCardSkeletonComponent,
    StatusBannerComponent,
    NoticesSectionComponent,
    HealthCheckBadgeComponent,
    StatusHistoryComponent
  ],
  templateUrl: './application-health-page.component.html',
  styleUrl: './application-health-page.component.scss'
})
export class ApplicationHealthPageComponent implements 
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

  public readonly healthData = rxResource({
    request: () => this.appSlug(),
    loader: () => of(this._generateMockHealthData())
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

  public readonly overallStatus = computed(() => {
    const data = this.healthData.value();
    if (!data) return { code: ApplicationHealthStatusCode.Operational, message: 'Loading...' };
    return { code: data.overallStatus, message: data.statusMessage };
  });

  public readonly statusHistory = computed(() => {
    return this.healthData.value()?.statusHistory ?? [];
  });

  public readonly services = computed(() => {
    return this.healthData.value()?.services ?? [];
  });

  public readonly notices = computed(() => {
    return this.healthData.value()?.notices ?? [];
  });

  private _generateMockHealthData() {
    return {
      overallStatus: ApplicationHealthStatusCode.Operational,
      statusMessage: 'All Systems Operational',
      lastUpdated: new Date(),
      services: [
        {
          name: 'API Service',
          uptime: 99.99,
          status: 'operational' as const,
          hasInfo: true
        },
        {
          name: 'Database',
          uptime: 100,
          status: 'operational' as const
        },
        {
          name: 'Storage Service',
          uptime: 99.95,
          status: 'operational' as const
        },
        {
          name: 'Authentication',
          uptime: 99.98,
          status: 'operational' as const
        },
        {
          name: 'CDN',
          uptime: 100,
          status: 'operational' as const
        }
      ] as ServiceStatus[],
      notices: [] as Notice[],
      statusHistory: this._generateStatusHistory()
    };
  }

  private _generateStatusHistory() {
    const history = [];
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      history.push({
        status: Math.random() > 0.95 
          ? ApplicationHealthStatusCode.Degraded 
          : ApplicationHealthStatusCode.Operational,
        timestamp: now - (i * 24 * 60 * 60 * 1000)
      });
    }
    return history;
  }
}
