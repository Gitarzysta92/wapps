import { ContentStateComponent, PageHeaderComponent, PageTitleComponent, MediumCardComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { Component, computed, input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { APPLICATIONS } from '@portals/shared/data';

@Component({
  selector: 'my-discussions-page',
  templateUrl: 'my-discussions.component.html',
  styleUrl: 'my-discussions.component.scss',
  standalone: true,
  imports: [PageHeaderComponent, PageTitleComponent, MediumCardComponent, BreadcrumbsComponent, TuiLink, TuiButton, ContentStateComponent, TuiAppearance, RouterLink]
})
export class MyDiscussionsPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  private readonly localData = inject(LocalDiscussionsService);
  readonly discussions = computed(() => APPLICATIONS.flatMap(app => this.localData.threads(app.slug)
    .filter(d => d.author.id === 'local-reader' || d.replies.some(r => r.author.id === 'local-reader'))
    .map(d => ({ ...d, appSlug: app.slug, appName: app.name })))
    .sort((a, b) => b.publishedTime.getTime() - a.publishedTime.getTime()));
}
