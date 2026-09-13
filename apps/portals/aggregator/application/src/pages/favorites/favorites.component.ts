import { ContentStateComponent, PageHeaderComponent, PageTitleComponent, MediumCardComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { Component, input, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import { FavoriteToggleButtonComponent, MyFavoritesService, MY_FAVORITES_STATE_PROVIDER } from '@portals/shared/features/my-favorites';
import { APPLICATIONS, DISCUSSIONS } from '@portals/shared/data';
import { CustomerFavoritesDto } from '@domains/customer/favorites';
import { map } from 'rxjs';
import { NAVIGATION } from '../../navigation';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { EntryDetailsDataService } from '../entry-details-page/entry-details-data.service';

@Component({
  selector: 'favorites-page',
  templateUrl: 'favorites.component.html',
  styleUrl: 'favorites.component.scss',
  standalone: true,
  imports: [TuiAppearance, PageHeaderComponent, PageTitleComponent, MediumCardComponent, BreadcrumbsComponent, ContentStateComponent, AsyncPipe, RouterLink, TuiButton, FavoriteToggleButtonComponent],
})
export class FavoritesPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  private readonly service = inject(MyFavoritesService);
  reload(): void { this.service.reload(); }
  private readonly favorites = inject(MY_FAVORITES_STATE_PROVIDER);
  private readonly content = inject(EntryDetailsDataService);
  readonly groups$ = this.favorites.myFavorites$.pipe(map(state => ({
    isError: state.isError,
    hasItems: Object.values(state.data).some(items => items.length > 0),
    groups: (['applications', 'suites', 'articles', 'discussions'] as const).map(type => ({
      type,
      browse: { applications: '/app', articles: '/articles', suites: '/suites', discussions: '/app' }[type],
      title: type.charAt(0).toUpperCase() + type.slice(1),
      items: state.data[type].map(slug => this.resolve(type, slug)),
    })),
  })));

  private resolve(type: keyof CustomerFavoritesDto, slug: string) {
    const fallback = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    if (type === 'applications') {
      const app = APPLICATIONS.find(item => item.slug === slug);
      return { slug, name: app?.name ?? fallback, path: buildRoutePath(NAVIGATION.application.path, { appSlug: slug }, { absolute: true }) };
    }
    if (type === 'articles') {
      const article = this.content.article(slug);
      return { slug, name: article?.title ?? fallback, path: buildRoutePath(NAVIGATION.article.path, { articleSlug: slug }, { absolute: true }) };
    }
    if (type === 'discussions') {
      const discussion = DISCUSSIONS.find(item => item.slug === slug);
      const app = APPLICATIONS.find(item => item.id === discussion?.associationId);
      return { slug, name: discussion?.title ?? fallback, path: app ? buildRoutePath(NAVIGATION.applicationDiscussion.path, { appSlug: app.slug, discussionSlug: slug }, { absolute: true }) : '/me/discussions' };
    }
    return { slug, name: this.content.suite(slug)?.title ?? fallback, path: buildRoutePath(NAVIGATION.suite.path, { suiteSlug: slug }, { absolute: true }) };
  }
}
