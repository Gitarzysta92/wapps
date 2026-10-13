import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
  MediumCardComponent,
} from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  NavigationDeclarationDto,
  buildRoutePath,
} from '@portals/shared/boundary/navigation';
import { Component, computed, input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import {
  FavoriteToggleButtonComponent,
  FavoriteContentService,
  type FavoriteContent,
} from '@portals/shared/features/my-favorites';
import { FAVORITE_KINDS, type FavoriteKind } from '@domains/customer/favorites';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'favorites-page',
  templateUrl: 'favorites.component.html',
  styleUrl: 'favorites.component.scss',
  standalone: true,
  imports: [
    TuiAppearance,
    PageHeaderComponent,
    PageTitleComponent,
    MediumCardComponent,
    BreadcrumbsComponent,
    ContentStateComponent,
    RouterLink,
    TuiButton,
    FavoriteToggleButtonComponent,
  ],
})
export class FavoritesPageComponent {
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly favoriteKind = input<
    'all' | FavoriteKind,
    'all' | FavoriteKind | undefined
  >('all', {
    transform: (value) => value ?? 'all',
  });
  readonly service = inject(FavoriteContentService);
  reload(): void {
    this.service.reload();
  }
  readonly groups = computed(() => {
    const state = this.service.view();
    const selected = this.favoriteKind();
    const kinds = FAVORITE_KINDS.filter(
      (kind) => selected === 'all' || selected === kind
    );
    const groups = kinds.map((type) => ({
      type,
      browse: {
        applications: '/app',
        articles: '/articles',
        suites: '/suites',
        discussions: '/app',
      }[type],
      title: type.charAt(0).toUpperCase() + type.slice(1),
      items: state.items
        .filter((item) => item.kind === type)
        .map((item) => ({ ...item, path: this.path(item) })),
    }));
    return {
      ...state,
      groups,
      hidden: groups.reduce(
        (count, group) =>
          count + group.items.filter((item) => item.status === 'hidden').length,
        0
      ),
      hasItems: groups.some((group) => group.items.length > 0),
    };
  });

  private path(item: FavoriteContent): string | null {
    if (!item.slug) return null;
    if (item.kind === 'applications')
      return buildRoutePath(
        NAVIGATION.application.path,
        { appSlug: item.slug },
        { absolute: true }
      );
    if (item.kind === 'articles')
      return buildRoutePath(
        NAVIGATION.article.path,
        { articleSlug: item.slug },
        { absolute: true }
      );
    if (item.kind === 'suites')
      return buildRoutePath(
        NAVIGATION.suite.path,
        { suiteSlug: item.slug },
        { absolute: true }
      );
    return item.appSlug
      ? buildRoutePath(
          NAVIGATION.applicationDiscussion.path,
          { appSlug: item.appSlug, discussionSlug: item.slug },
          { absolute: true }
        )
      : null;
  }
}
