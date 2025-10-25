import { Routes } from "@angular/router";

import { tuiGenerateDialogableRoute } from "@taiga-ui/kit";

import { AuthenticationDialogComponent } from "./dialogs/authentication-dialog/authentication-dialog.component";
import { LostPasswordDialogComponent } from "./dialogs/lost-password-dialog/lost-password-dialog.component";
import { RegistrationDialogComponent } from "./dialogs/registration-dialog/registration-dialog.component";
import { HomePageComponent } from "./pages/home/home.component";
import { RoutableDialogComponent } from "@ui/routable-dialog";
import { AppShellComponent, IAppShellRouteData } from "./shells/app-shell/app-shell.component";
import { FILTERS } from "./filters";
import { APPLICATION_VIEW_MAIN_NAVIGATION, HOME_VIEW_MAIN_NAVIGATION, NAVIGATION } from "./navigation";
import { AuthenticationGuard } from "@portals/shared/features/identity";
import { HeaderPartialComponent } from "./partials/header/header.component";
import { LeftSidebarPartialComponent } from "./partials/left-sidebar/left-sidebar.component";
import { ApplicationLeftSidebarPartialComponent } from "./partials/application-left-sidebar/application-left-sidebar.component";
import { RightSidebarPartialComponent } from "./partials/right-sidebar/right-sidebar.component";
import { applicationsMatcher } from "./pages/applications/applications.matcher";
import { FooterPartialComponent } from "./partials/footer/footer.component";

export interface IBreadcrumbRouteData {
  breadcrumb: string;
}


export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    providers: [AuthenticationGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: NAVIGATION.home.path,
      },
      {
        path: NAVIGATION.home.path,
        component: HomePageComponent,
        data: {
          breadcrumb: NAVIGATION.home.label,
          header: null,
          leftSidebar: {
            component: LeftSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationOverview.path,
        redirectTo: NAVIGATION.applicationOverview.path.replace('/overview', ''),
        pathMatch: 'full'
      },
      {
        path: `${NAVIGATION.applicationOverview.path}`,
        loadComponent: () => import('./pages/application-overview-page/application-overview-page.component').then(m => m.ApplicationOverviewPageComponent),
        data: {
          breadcrumb: 'Overview',
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationHealth.path,
        loadComponent: () => import('./pages/application-health-page/application-health-page.component').then(m => m.ApplicationHealthPageComponent),
        data: {
          breadcrumb: 'Health',
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationDevLog.path,
        loadComponent: () => import('./pages/application-devlog-page/application-devlog-page.component').then(m => m.ApplicationDevlogPageComponent),
        data: {
          breadcrumb: 'Dev Log',
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationReviews.path,
        loadComponent: () => import('./pages/application-reviews-page/application-reviews-page.component').then(m => m.ApplicationReviewsPageComponent),
        data: {
          breadcrumb: 'Review',
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationTopics.path,
        loadComponent: () => import('./pages/application-discussions-page/application-discussions-page.component').then(m => m.ApplicationDiscussionsPageComponent),
        data: {
          breadcrumb: 'Discussions',
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationTopic.path,
        loadComponent: () => import('./pages/application-topic-page/application-topic-page.component').then(m => m.ApplicationTopicPageComponent),
        data: {
          breadcrumb: 'Discussion',
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationTimeline.path,
        loadComponent: () => import('./pages/application-timeline-page/application-timeline-page.component').then(m => m.ApplicationTimelinePageComponent),
        data: {
          breadcrumb: 'Timeline',
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        matcher: applicationsMatcher,
        loadComponent: () => import('./pages/applications/applications.component').then(m => m.ApplicationsPageComponent),
        data: {
          breadcrumb: NAVIGATION.applications.label,
          header: HeaderPartialComponent,
          leftSidebar: {
            component: LeftSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.suites.path,
        loadComponent: () => import('./pages/suites/suites.component').then(m => m.SuitesPageComponent),
        data: {
          breadcrumb: NAVIGATION.suites.label,
          header: HeaderPartialComponent,
          leftSidebar: {
            component: LeftSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
        children: [
          {
            path: `:${FILTERS.category}/page/:page`,
            loadComponent: () => import('./pages/suites/suites.component').then(m => m.SuitesPageComponent),
          },
          {
            path: 'page/:page',
            loadComponent: () => import('./pages/suites/suites.component').then(m => m.SuitesPageComponent),
          }
        ]
      },
      {
        path: NAVIGATION.articles.path,
        loadComponent: () => import('./pages/articles/articles.component').then(m => m.ArticlesPageComponent),
        data: {
          breadcrumb: NAVIGATION.articles.label,
          header: HeaderPartialComponent,
          leftSidebar: {
            component: LeftSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: RightSidebarPartialComponent,
          footer: FooterPartialComponent
        } as IAppShellRouteData & IBreadcrumbRouteData,
        children: [
          {
            path: `:${FILTERS.category}/page/:page`,
            loadComponent: () => import('./pages/articles/articles.component').then(m => m.ArticlesPageComponent),
          },
          {
            path: 'page/:page',
            loadComponent: () => import('./pages/articles/articles.component').then(m => m.ArticlesPageComponent),
          }
        ]
      },
      {
        path: NAVIGATION.favourites.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/favourites/favourites.component').then(m => m.FavouritesPageComponent),
        data: { breadcrumb: NAVIGATION.favourites.label },
      },
      {
        path: NAVIGATION.mySuites.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/my-suites/my-suites.component').then(m => m.MySuitesPageComponent),
        data: { breadcrumb: NAVIGATION.mySuites.label },
      },
      {
        path: NAVIGATION.myApps.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/my-apps/my-apps.component').then(m => m.MyAppsPageComponent),
        data: { breadcrumb: NAVIGATION.myApps.label },
      },
      {
        path: NAVIGATION.ownership.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/ownership/ownership.component').then(m => m.OwnershipPageComponent),
        data: { breadcrumb: NAVIGATION.ownership.label },
      },
      {
        path: 'results',
        loadComponent: () => import('./pages/search-results-page/search-results-page.component').then(m => m.SearchResultsPageComponent),
        children: [
          {
            path: 'page/:page',
            loadComponent: () => import('./pages/search-results-page/search-results-page.component').then(m => m.SearchResultsPageComponent),
          }
        ]
      },
      {
        path: NAVIGATION.tags.path,
        loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
        children: [
          {
            path: `:${FILTERS.tag}/page/:page`,
            loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
          },
          {
            path: 'page/:page',
            loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
          }
        ]
      },
      {
        path: NAVIGATION.categories.path,
        loadComponent: () => import('./pages/category-results-page/category-results-page.component').then(m => m.CategoryResultsPageComponent),
        children: [
          {
            path: `:${FILTERS.category}/page/:page`,
            loadComponent: () => import('./pages/category-results-page/category-results-page.component').then(m => m.CategoryResultsPageComponent),
          },
          {
            path: 'page/:page',
            loadComponent: () => import('./pages/category-results-page/category-results-page.component').then(m => m.CategoryResultsPageComponent),
          }
        ]
      },
      {
        path: ':entrySlug',
        loadComponent: () => import('./pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
      },
      // {
      //   path: 'my-listings',
      //   canActivate: [AuthenticationGuard],
      //   loadComponent: () => import('../../../libs/features/listing/shells/category/listing-category-shell.module').then(m => m.ListingCategoryShellModule),
      //   children: [
      //     {
      //       path: 'manage',
      //       loadComponent: () => import('../../../libs/features/listing/shells/category/listing-category-shell.module').then(m => m.ListingCategoryShellModule),
      //     },
      //   ]
      // },
      {
        path: 'organization',
        canActivate: [AuthenticationGuard],
        children: [
          // {
          //   path: 'ownership',
          //   loadComponent: () => import('../../../libs/features/listing/shells/category/listing-category-shell.module').then(m => m.ListingCategoryShellModule),
          // },
          // {
          //   path: 'usage-plan',
          //   loadComponent: () => import('../../../libs/features/listing/shells/category/listing-category-shell.module').then(m => m.ListingCategoryShellModule),
          // },
        ]
      },
      {
        path: NAVIGATION.settings.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsPageComponent),
        data: { breadcrumb: NAVIGATION.settings.label },
        children: [
          // {
          //   path: 'user',
          //   loadComponent: () => import('../../../libs/features/listing/shells/category/listing-category-shell.module').then(m => m.ListingCategoryShellModule),
          // },
          // {
          //   path: 'profile',
          //   loadComponent: () => import('../../../libs/features/listing/shells/category/listing-category-shell.module').then(m => m.ListingCategoryShellModule),
          // },
        ]
      }
    ]
  },
  {
    ...tuiGenerateDialogableRoute(RoutableDialogComponent, {
      path: 'identity',
      outlet: 'dialog',
    }),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'authenticate'
      },
      {
        path: 'authenticate',
        component: AuthenticationDialogComponent
      },
      {
        path: 'recover',
        component: LostPasswordDialogComponent
      },
      {
        path: 'register',
        component: RegistrationDialogComponent
      },
      {
        path: '**',
        redirectTo: ""
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'page-not-found'
  }

];