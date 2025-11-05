import { Routes } from "@angular/router";
import { tuiGenerateDialogableRoute } from "@taiga-ui/kit";
import { AuthenticationDialogComponent } from "./dialogs/authentication-dialog/authentication-dialog.component";
import { LostPasswordDialogComponent } from "./dialogs/lost-password-dialog/lost-password-dialog.component";
import { RegistrationDialogComponent } from "./dialogs/registration-dialog/registration-dialog.component";
import { HomePageComponent } from "./pages/home/home.component";
import { RoutableDialogComponent } from "@ui/routable-dialog";
import { AppShellComponent, IAppShellRouteData } from "./shells/app-shell/app-shell.component";
import { FILTERS } from "./filters";
import { APPLICATION_VIEW_MAIN_NAVIGATION, FOOTER_MAIN_NAVIGATION, FOOTER_QUATERNARY_NAVIGATION, FOOTER_SECONDARY_NAVIGATION, FOOTER_TERTIARY_NAVIGATION, HOME_VIEW_MAIN_NAVIGATION, NAVIGATION, AUTHENTICATED_USER_MAIN_NAVIGATION, AUTHENTICATED_USER_SECONDARY_NAVIGATION, UNAUTHENTICATED_USER_MAIN_NAVIGATION, UNAUTHENTICATED_USER_SECONDARY_NAVIGATION } from "./navigation";
import { AuthenticationGuard } from "@portals/shared/features/identity";
import { HeaderPartialComponent } from "./partials/header/header.component";
import { CommonSidebarPartialComponent } from "./partials/common-sidebar/common-sidebar.component";
import { ApplicationLeftSidebarPartialComponent } from "./partials/application-left-sidebar/application-left-sidebar.component";
import { UserSidebarPartialComponent } from "./partials/user-sidebar/user-sidebar.component";
import { applicationsMatcher } from "./pages/applications/applications.matcher";
import { searchResultsMatcher } from "./pages/search-results-page/search-results.matcher";
import { FooterPartialComponent } from "./partials/footer/footer.component";
import { IBreadcrumbRouteData } from '@portals/shared/boundary/navigation';


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
          breadcrumb: [ NAVIGATION.home ],
          header: null,
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.application.path,
        redirectTo: NAVIGATION.applicationOverview.path,
        pathMatch: 'full'
      },
      {
        path: `${NAVIGATION.applicationOverview.path}`,
        loadComponent: () => import('./pages/application-overview-page/application-overview-page.component').then(m => m.ApplicationOverviewPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationOverview ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationHealth.path,
        loadComponent: () => import('./pages/application-health-page/application-health-page.component').then(m => m.ApplicationHealthPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationHealth ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationDevLog.path,
        loadComponent: () => import('./pages/application-devlog-page/application-devlog-page.component').then(m => m.ApplicationDevlogPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationDevLog ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationReviews.path,
        loadComponent: () => import('./pages/application-reviews-page/application-reviews-page.component').then(m => m.ApplicationReviewsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationReviews ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
            {
        path: NAVIGATION.applicationReview.path,
        loadComponent: () => import('./pages/application-reviews-page/application-reviews-page.component').then(m => m.ApplicationReviewsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationReviews, NAVIGATION.applicationReview ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationTopics.path,
        loadComponent: () => import('./pages/application-discussions-page/application-discussions-page.component').then(m => m.ApplicationDiscussionsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationTopics ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationTopic.path,
        loadComponent: () => import('./pages/application-topic-page/application-topic-page.component').then(m => m.ApplicationTopicPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationTopics, NAVIGATION.applicationTopic ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.applicationTimeline.path,
        loadComponent: () => import('./pages/application-timeline-page/application-timeline-page.component').then(m => m.ApplicationTimelinePageComponent),
        data: {
          breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationTimeline ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        // INFO: custom matcher is used to mitigate 
        // unnecessary component instantiation
        // for related dynamic routes
        matcher: applicationsMatcher,
        loadComponent: () => import('./pages/applications/applications.component').then(m => m.ApplicationsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.applications ],
          header: {
            component: HeaderPartialComponent,
          },
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.suites.path,
        loadComponent: () => import('./pages/suites/suites.component').then(m => m.SuitesPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.suites ],
          header: {
            component: HeaderPartialComponent,
          },
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
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
        path: NAVIGATION.suite.path,
        loadComponent: () => import('./pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.suites, NAVIGATION.suite ],
          header: null,
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.createSuite.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.suites, NAVIGATION.createSuite ],
          header: null,
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.favouriteSuites.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/suites/suites.component').then(m => m.SuitesPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.favouriteSuites ],
          header: {
            component: HeaderPartialComponent,
          },
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.articles.path,
        loadComponent: () => import('./pages/articles/articles.component').then(m => m.ArticlesPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.articles ],
          header: {
            component: HeaderPartialComponent,
          },
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
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
        path: NAVIGATION.article.path,
        loadComponent: () => import('./pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.articles, NAVIGATION.article ],
          header: null,
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.myfavourites.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/favourites/favourites.component').then(m => m.FavouritesPageComponent),
        data: { breadcrumb: [ NAVIGATION.myfavourites ] },
      },
      {
        path: NAVIGATION.mySuites.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/my-suites/my-suites.component').then(m => m.MySuitesPageComponent),
        data: { breadcrumb: [ NAVIGATION.mySuites ] },
      },
      {
        path: NAVIGATION.favouriteApplications.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/favourites/favourites.component').then(m => m.FavouritesPageComponent),
        data: { breadcrumb: [ NAVIGATION.favouriteApplications ] },
      },
      {
        path: NAVIGATION.myApplications.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/my-apps/my-apps.component').then(m => m.MyAppsPageComponent),
        data: { breadcrumb: [ NAVIGATION.myApplications ] },
      },
      {
        path: NAVIGATION.registerApplication.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.applications, NAVIGATION.registerApplication ],
          header: null,
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.claimApplicationOwnership.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/ownership/ownership.component').then(m => m.OwnershipPageComponent),
        data: { breadcrumb: [ NAVIGATION.claimApplicationOwnership ] },
      },
      {
        // INFO: custom matcher is used to mitigate 
        // unnecessary component instantiation
        // for related dynamic routes
        matcher: searchResultsMatcher,
        loadComponent: () => import('./pages/search-results-page/search-results-page.component').then(m => m.SearchResultsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.search ],
          header: null,
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.tags.path,
        loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.tags ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.tag.path,
        loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.tags, NAVIGATION.tag ],
          header: null,
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.searchByTag.path,
        loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.tags, NAVIGATION.tag, NAVIGATION.searchByTag ],
          header: null,
          leftSidebar: {
            component: CommonSidebarPartialComponent,
            inputs: { navigation: HOME_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        } as IAppShellRouteData & IBreadcrumbRouteData,
      },
      {
        path: NAVIGATION.categories.path,
        data: {
          breadcrumb: [ NAVIGATION.categories ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        },
        loadComponent: () => import('./pages/category-results-page/category-results-page.component').then(m => m.CategoryResultsPageComponent),
      },
      {
        path: NAVIGATION.category.path,
        data: {
          breadcrumb: [ NAVIGATION.category ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        },
        loadComponent: () => import('./pages/category-results-page/category-results-page.component').then(m => m.CategoryResultsPageComponent),
      },
      {
        path: NAVIGATION.searchByCategory.path,
        data: {
          breadcrumb: [ NAVIGATION.searchByCategory ],
          header: null,
          leftSidebar: {
            component: ApplicationLeftSidebarPartialComponent,
            inputs: { navigation: APPLICATION_VIEW_MAIN_NAVIGATION }
          },
          rightSidebar: {
            component: UserSidebarPartialComponent,
            inputs: {
              navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
              navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
              unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
              unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
            },
          },
          footer: {
            component: FooterPartialComponent,
            inputs: {
              primaryNavigation: FOOTER_MAIN_NAVIGATION,
              secondaryNavigation: FOOTER_SECONDARY_NAVIGATION,
              tertiaryNavigation: FOOTER_TERTIARY_NAVIGATION,
              quaternaryNavigation: FOOTER_QUATERNARY_NAVIGATION
            }
          }
        },
        loadComponent: () => import('./pages/category-results-page/category-results-page.component').then(m => m.CategoryResultsPageComponent),
      },
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
        path: NAVIGATION.myProfile.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsPageComponent),
        data: { breadcrumb: [ NAVIGATION.myProfile ] },
      },
      {
        path: NAVIGATION.settings.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsPageComponent),
        data: { breadcrumb: [ NAVIGATION.settings ] },
        children: [
          {
            path: 'user',
            loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsPageComponent),
            data: { breadcrumb: [ NAVIGATION.settings, NAVIGATION.settingsUser ] },
          },
          {
            path: 'profile',
            loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsPageComponent),
            data: { breadcrumb: [ NAVIGATION.settings, NAVIGATION.settingsProfile ] },
          },
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