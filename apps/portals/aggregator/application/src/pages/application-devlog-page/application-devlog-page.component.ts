import { Component, inject, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { of, delay } from 'rxjs';
import { TuiButton, TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiChip, TuiBadge } from '@taiga-ui/kit';
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

interface ChangelogEntry {
  version: string;
  releaseDate: Date;
  description: string;
  type: 'major' | 'minor' | 'patch';
  changes: { type: string; description: string }[];
}

@Component({
  selector: 'app-application-devlog-page',
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiIcon,
    TuiChip,
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
    MediumCardSkeletonComponent
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
      const app = APPLICATIONS.find(a => a.slug === appSlug) ?? this._buildMockFromSlug(appSlug ?? 'unknown');
      return of(app).pipe(delay(1000));
    }
  });

  public readonly changelog = rxResource({
    request: () => this.appSlug(),
    loader: () => of(this._generateMockChangelog()).pipe(delay(1200))
  });

  public readonly breadcrumbData = computed(() => {
    const breadcrumb = this.breadcrumb();
    
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

  public readonly latestEntry = computed(() => this.changelog.value()?.[0] ?? null);
  public readonly previousEntries = computed(() => this.changelog.value()?.slice(1) ?? []);

  getChangeTypeLabel(type: 'major' | 'minor' | 'patch'): string {
    switch (type) {
      case 'major': return 'Major Update';
      case 'minor': return 'Minor Update';
      case 'patch': return 'Patch';
    }
  }

  getChangeTypeAppearance(type: 'major' | 'minor' | 'patch'): string {
    switch (type) {
      case 'major': return 'error';
      case 'minor': return 'primary';
      case 'patch': return 'neutral';
    }
  }

  private _buildMockFromSlug(slug: string): AppRecordDto {
    const name = slug
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return {
      id: slug,
      slug,
      name,
      description: `${name} description`,
      logo: 'https://picsum.photos/128',
      isPwa: true,
      rating: 4.7,
      tagIds: [],
      categoryId: '0',
      platformIds: [],
      reviewNumber: 1234,
      updateDate: new Date(),
      listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    };
  }

  private _generateMockChangelog(): ChangelogEntry[] {
    return [
      {
        version: '2.1.0',
        releaseDate: new Date(),
        description: 'Major update with new features and improvements',
        type: 'major',
        changes: [
          { type: 'feature', description: 'New user interface improvements' },
          { type: 'feature', description: 'Performance optimizations' },
          { type: 'fix', description: 'Bug fixes and stability improvements' },
          { type: 'feature', description: 'Added dark mode support' },
          { type: 'security', description: 'Enhanced security features' }
        ]
      },
      {
        version: '2.0.3',
        releaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
        description: 'Minor bug fixes and improvements',
        type: 'patch',
        changes: [
          { type: 'fix', description: 'Fixed login issue on mobile devices' },
          { type: 'fix', description: 'Resolved performance regression' }
        ]
      },
      {
        version: '2.0.0',
        releaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        description: 'Complete redesign with new features',
        type: 'major',
        changes: [
          { type: 'feature', description: 'Complete UI redesign' },
          { type: 'feature', description: 'New dashboard experience' },
          { type: 'feature', description: 'Integration with external services' }
        ]
      }
    ];
  }
}
