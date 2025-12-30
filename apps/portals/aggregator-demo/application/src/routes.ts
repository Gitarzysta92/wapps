import { Routes, ActivatedRouteSnapshot } from "@angular/router";
import { tuiGenerateDialogableRoute } from "@taiga-ui/kit";
import { AuthenticationDialogComponent } from "./dialogs/authentication-dialog/authentication-dialog.component";
import { LostPasswordDialogComponent } from "./dialogs/lost-password-dialog/lost-password-dialog.component";
import { RegistrationDialogComponent } from "./dialogs/registration-dialog/registration-dialog.component";
import { HomePageComponent } from "./pages/home/home.component";
import { RoutableDialogComponent } from "@ui/routable-dialog";
import { AppShellComponent, IAppShellRouteData } from "./shells/app-shell/app-shell.component";
import { FILTERS } from "./filters";
import { APPLICATION_VIEW_MAIN_NAVIGATION, FOOTER_MAIN_NAVIGATION, FOOTER_QUATERNARY_NAVIGATION, FOOTER_SECONDARY_NAVIGATION, FOOTER_TERTIARY_NAVIGATION, MOBILE_MAIN_NAVIGATION, NAVIGATION, AUTHENTICATED_USER_MAIN_NAVIGATION, AUTHENTICATED_USER_SECONDARY_NAVIGATION, UNAUTHENTICATED_USER_MAIN_NAVIGATION, UNAUTHENTICATED_USER_SECONDARY_NAVIGATION, DESKTOP_MAIN_NAVIGATION, DESKTOP_USER_MAIN_NAVIGATION, SETTINGS_NAVIGATION } from "./navigation";
import { AuthenticationGuard } from "@portals/shared/features/identity";
import { HeaderPartialComponent } from "./partials/header/header.component";
import { CommonSidebarComponent } from "./partials/common-sidebar/common-sidebar.component";
import { CommonMobileBottomBarPartialComponent } from "./partials/common-mobile-bottom-bar/common-mobile-bottom-bar.component";

import { SearchResultsSidebarComponent } from "./partials/search-results-sidebar/search-results-sidebar.component"; 
import { applicationsMatcher } from "./pages/applications/applications.matcher";
import { searchResultsMatcher } from "./pages/search-results-page/search-results.matcher";
import { FooterPartialComponent } from "./partials/footer/footer.component";
import { IBreadcrumbRouteData } from '@portals/shared/boundary/navigation';
import { UserPanelSheetComponent } from "./partials/user-panel-sheet";
import { UserAuxiliarySidebarComponent } from "./partials/user-auxiliary-sidebar/user-auxiliary-sidebar.component";
import { UserCommonSidebarComponent } from "./partials/user-common-sidebar/user-common-sidebar.component";
import { profileAvatarResolver } from "./resolvers/profile-avatar.resolver";
import { breadcrumbResolver } from "./resolvers/breadcrumb.resolver";
import { resolversFrom } from "@portals/shared/boundary/routing";
import { sidebarResolver } from "./resolvers/sidebar.resolver";
import { navigationResolver } from "./resolvers/navigation.resolver";
import { provideApplicationOverviewFeature } from '@portals/shared/features/application-overview';
import { ApplicationCommonSidebarComponent } from "./partials/application-common-sidebar/application-common-sidebar.component";


// TODO: check if flat list approach
// does not influence route matching performance
// because tree structure can be faster in some cases
// test form ssr and csr standpoint

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
          breadcrumb: [NAVIGATION.home],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: {
              navigationPrimary: MOBILE_MAIN_NAVIGATION,
              sheetDialog: {
                component: UserPanelSheetComponent,
                inputs: {
                  navigationPrimary: AUTHENTICATED_USER_MAIN_NAVIGATION,
                  navigationSecondary: AUTHENTICATED_USER_SECONDARY_NAVIGATION,
                  unauthenticatedNavigationPrimary: UNAUTHENTICATED_USER_MAIN_NAVIGATION,
                  unauthenticatedNavigationSecondary: UNAUTHENTICATED_USER_SECONDARY_NAVIGATION
                }
              }
            }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: DESKTOP_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
        path: '',
        providers: [provideApplicationOverviewFeature().providers],
        data: {asd: 'asd'},
        children: [
          {
            path: NAVIGATION.application.path,
            redirectTo: NAVIGATION.applicationOverview.path,
            pathMatch: 'full'
          },
          {
            path: `${NAVIGATION.applicationOverview.path}`,
            loadComponent: () => import('./pages/application-overview-page/application-overview-page.component').then(m => m.ApplicationOverviewPageComponent),
            resolve: {
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationSecondary: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [
                NAVIGATION.home,
                NAVIGATION.application,
                NAVIGATION.applicationOverview
              ],
              bottomBar: {
                component: CommonMobileBottomBarPartialComponent,
                inputs: { navigation: MOBILE_MAIN_NAVIGATION }
              },
              rightSidebar: {
                component: UserAuxiliarySidebarComponent,
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
            resolve: {
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                secondaryNavigation: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationHealth ],
              bottomBar: {
                component: CommonMobileBottomBarPartialComponent,
                inputs: { navigation: MOBILE_MAIN_NAVIGATION }
              },
              rightSidebar: {
                component: UserAuxiliarySidebarComponent,
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
            resolve: {
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                secondaryNavigation: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationDevLog ],
              bottomBar: {
                component: CommonMobileBottomBarPartialComponent,
                inputs: { navigation: MOBILE_MAIN_NAVIGATION }
              },
              rightSidebar: {
                component: UserAuxiliarySidebarComponent,
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
            resolve: {
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                secondaryNavigation: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationReviews ],
              bottomBar: {
                component: CommonMobileBottomBarPartialComponent,
                inputs: { navigation: MOBILE_MAIN_NAVIGATION }
              },
              rightSidebar: {
                component: UserAuxiliarySidebarComponent,
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
            resolve: {
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                secondaryNavigation: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationReviews, NAVIGATION.applicationReview ],
              bottomBar: {
                component: CommonMobileBottomBarPartialComponent,
                inputs: { navigation: MOBILE_MAIN_NAVIGATION }
              },
              rightSidebar: {
                component: UserAuxiliarySidebarComponent,
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
            path: NAVIGATION.applicationDiscussions.path,
            loadComponent: () => import('./pages/application-discussions-page/application-discussions-page.component').then(m => m.ApplicationDiscussionsPageComponent),
            resolve: {
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationSecondary: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              }),
              breadcrumb: breadcrumbResolver([
                NAVIGATION.home,
                NAVIGATION.application,
                NAVIGATION.applicationDiscussions,
              ]),
            },
            data: {
              bottomBar: {
                component: CommonMobileBottomBarPartialComponent,
                inputs: { navigation: MOBILE_MAIN_NAVIGATION }
              },
              rightSidebar: {
                component: UserAuxiliarySidebarComponent,
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
            } as IAppShellRouteData,
          },
          {
            path: NAVIGATION.applicationDiscussion.path,
            loadComponent: () => import('./pages/application-discussion-page/application-discussion-page.component').then(m => m.ApplicationDiscussionPageComponent),
            resolve: {
              breadcrumb: breadcrumbResolver([
                NAVIGATION.home,
                NAVIGATION.application,
                NAVIGATION.applicationDiscussions,
                NAVIGATION.applicationDiscussion
              ]),
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationSecondary: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            } as resolversFrom<IBreadcrumbRouteData>,
            data: {
              bottomBar: {
                component: CommonMobileBottomBarPartialComponent,
                inputs: { navigation: MOBILE_MAIN_NAVIGATION }
              },
              rightSidebar: {
                component: UserAuxiliarySidebarComponent,
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
            } as IAppShellRouteData,
          },
          {
            path: NAVIGATION.applicationTimeline.path,
            loadComponent: () => import('./pages/application-timeline-page/application-timeline-page.component').then(m => m.ApplicationTimelinePageComponent),
            resolve: {
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug') ?? '',
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.application, NAVIGATION.applicationTimeline ],
              bottomBar: {
                component: CommonMobileBottomBarPartialComponent,
                inputs: { navigation: MOBILE_MAIN_NAVIGATION }
              },
              rightSidebar: {
                component: UserAuxiliarySidebarComponent,
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
        ]
      },
      {
        // INFO: custom matcher is used to mitigate 
        // unnecessary component instantiation
        // for related dynamic routes
        matcher: applicationsMatcher,
        loadComponent: () => import('./pages/applications/applications.component').then(m => m.ApplicationsPageComponent),
        data: {
          breadcrumb: [NAVIGATION.applications],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          header: {
            component: HeaderPartialComponent,
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          breadcrumb: [NAVIGATION.suites],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          header: {
            component: HeaderPartialComponent,
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          breadcrumb: [NAVIGATION.favouriteSuites],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          header: {
            component: HeaderPartialComponent,
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          breadcrumb: [NAVIGATION.articles],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          header: {
            component: HeaderPartialComponent,
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
        path: NAVIGATION.mySuites.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/my-suites/my-suites.component').then(m => m.MySuitesPageComponent),
        data: { breadcrumb: [ NAVIGATION.mySuites ] },
      },
      {
        path: NAVIGATION.mefavouriteApplications.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/favorites/favorites.component').then(m => m.FavoritesPageComponent),
        data: { breadcrumb: [ NAVIGATION.mefavouriteApplications ] },
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
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          breadcrumb: [ NAVIGATION.home,NAVIGATION.search ],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: SearchResultsSidebarComponent,
            inputs: {}
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: APPLICATION_VIEW_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: APPLICATION_VIEW_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: APPLICATION_VIEW_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: APPLICATION_VIEW_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
        loadComponent: () => import('./pages/my-profile-page/my-profile-page.component').then(m => m.MyProfilePageComponent),
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.myProfile],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: { 
            component: UserCommonSidebarComponent,
            inputs: {
              navigation: DESKTOP_USER_MAIN_NAVIGATION
            }
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
        path: NAVIGATION.myFavorite.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/favorites/favorites.component').then(m => m.FavoritesPageComponent),
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.myFavorite],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
        path: NAVIGATION.myDiscussions.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/my-discussions/my-discussions.component').then(m => m.MyDiscussionsPageComponent),
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.myDiscussions],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: CommonSidebarComponent,
            inputs: {
              navigation: MOBILE_MAIN_NAVIGATION,
              navigationSecondary: null
            }
          },
          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
        path: NAVIGATION.userProfile.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/profile-page/profile-page.component').then(m => m.ProfilePageComponent),
        resolve: {
          leftSidebar:
            sidebarResolver(CommonSidebarComponent, {
              avatar: profileAvatarResolver(),
              navigation: DESKTOP_USER_MAIN_NAVIGATION
            })
        },
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.myProfile],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },

          rightSidebar: {
            component: UserAuxiliarySidebarComponent,
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
        path: NAVIGATION.settings.path,
        canActivate: [AuthenticationGuard],
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.settings],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigation: MOBILE_MAIN_NAVIGATION }
          },
          leftSidebar: {
            component: UserCommonSidebarComponent,
            inputs: {
              navigation: DESKTOP_USER_MAIN_NAVIGATION,
              navigationSecondary: SETTINGS_NAVIGATION
            }
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
            path: '',
            pathMatch: 'full',
            redirectTo: 'profile',
          },
          {
            path: 'profile',
            loadComponent: () => import('./pages/settings-profile/settings-profile.component').then(m => m.SettingsProfilePageComponent),
            data: { breadcrumb: [NAVIGATION.home, NAVIGATION.settings, NAVIGATION.settingsProfile] },
          },
          {
            path: 'preferences',
            loadComponent: () => import('./pages/settings-preferences/settings-preferences.component').then(m => m.SettingsPreferencesPageComponent),
            data: { breadcrumb: [NAVIGATION.home, NAVIGATION.settings, NAVIGATION.settingsPreferences] },
          },
          {
            path: 'notifications',
            loadComponent: () => import('./pages/settings-notifications/settings-notifications.component').then(m => m.SettingsNotificationsPageComponent),
            data: { breadcrumb: [NAVIGATION.home, NAVIGATION.settings, NAVIGATION.settingsNotifications] },
          },
          {
            path: 'privacy',
            loadComponent: () => import('./pages/settings-privacy/settings-privacy.component').then(m => m.SettingsPrivacyPageComponent),
            data: { breadcrumb: [NAVIGATION.home, NAVIGATION.settings, NAVIGATION.settingsPrivacy] },
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