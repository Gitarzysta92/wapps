import { APPLICATION_WORKSPACE_PATHS } from './navigation';
import { USE_CATALOG_BFF, API_BASE_URL, CATALOG_MODE } from './environment';
import { Routes, ActivatedRouteSnapshot } from "@angular/router";
import { tuiGenerateDialogableRoute } from "@taiga-ui/kit";
import { AuthenticationDialogComponent } from "./dialogs/authentication-dialog/authentication-dialog.component";
import { LostPasswordDialogComponent } from "./dialogs/lost-password-dialog/lost-password-dialog.component";
import { RegistrationDialogComponent } from "./dialogs/registration-dialog/registration-dialog.component";
import { RoutableDialogComponent } from "@ui/routable-dialog";
import { AppShellComponent, IAppShellRouteData } from "./shells/app-shell/app-shell.component";
import { FILTERS } from "./filters";
import { APPLICATION_VIEW_MAIN_NAVIGATION, FOOTER_MAIN_NAVIGATION, FOOTER_QUATERNARY_NAVIGATION, FOOTER_SECONDARY_NAVIGATION, FOOTER_TERTIARY_NAVIGATION, MOBILE_MAIN_NAVIGATION, NAVIGATION, AUTHENTICATED_USER_MAIN_NAVIGATION, AUTHENTICATED_USER_SECONDARY_NAVIGATION, UNAUTHENTICATED_USER_MAIN_NAVIGATION, UNAUTHENTICATED_USER_SECONDARY_NAVIGATION, DESKTOP_MAIN_NAVIGATION, DESKTOP_USER_MAIN_NAVIGATION, SETTINGS_NAVIGATION } from "./navigation";
import { AuthenticationGuard, OAuthCallbackComponent } from "@portals/shared/features/identity";
import { HeaderPartialComponent } from "./partials/header/header.component";
import { CommonSidebarComponent } from "./partials/common-sidebar/common-sidebar.component";
import { CommonMobileBottomBarPartialComponent } from "./partials/common-mobile-bottom-bar/common-mobile-bottom-bar.component";

import { DISCOVER_REDIRECT_ROUTES } from "./pages/discover/discover-redirect.routes";
import { FooterPartialComponent } from "./partials/footer/footer.component";
import { IBreadcrumbRouteData, NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { UserPanelSheetComponent } from "./partials/user-panel-sheet";
import { UserAuxiliarySidebarComponent } from "./partials/user-auxiliary-sidebar/user-auxiliary-sidebar.component";
import { UserCommonSidebarComponent } from "./partials/user-common-sidebar/user-common-sidebar.component";
import { profileAvatarResolver } from "./resolvers/profile-avatar.resolver";
import { breadcrumbResolver } from "./resolvers/breadcrumb.resolver";
import { resolversFrom } from "@portals/shared/boundary/routing";
import { sidebarResolver } from "./resolvers/sidebar.resolver";
import { navigationResolver } from "./resolvers/navigation.resolver";
import { PROFILE_VIEW_MAIN_NAVIGATION, PUBLIC_PROFILE_VIEW_MAIN_NAVIGATION } from './navigation';
import { provideApplicationOverviewFeature } from '@portals/shared/features/application-overview';
import { ApplicationCommonSidebarComponent } from "./partials/application-common-sidebar/application-common-sidebar.component";

const contextBottomBar = (navigation: NavigationDeclarationDto[], section: NavigationDeclarationDto) => sidebarResolver(
  CommonMobileBottomBarPartialComponent,
  {
    navigationPrimary: navigationResolver([...navigation, NAVIGATION.explore]),
    navigationActive: navigationResolver(section),
  },
);

const applicationBottomBar = (section: NavigationDeclarationDto) =>
  contextBottomBar(APPLICATION_VIEW_MAIN_NAVIGATION, section);

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
        path: 'auth/action',
        loadComponent: () => import('./pages/password-reset/password-reset-page.component').then(m => m.PasswordResetPageComponent),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: NAVIGATION.home.path,
      },
      {
        path: NAVIGATION.home.path,
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomePageComponent),
        data: {
          breadcrumb: [NAVIGATION.home],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: {
              navigationPrimary: MOBILE_MAIN_NAVIGATION
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
        path: NAVIGATION.registerApplication.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/application-drafts/application-drafts.component').then(m => m.ApplicationDraftsPageComponent)
          : import('./pages/register-application/register-application.component').then(m => m.RegisterApplicationPageComponent),
        data: {
          draftMode: 'edit',
          breadcrumb: [ NAVIGATION.home, NAVIGATION.applications, NAVIGATION.registerApplication ],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
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
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/private-suites/private-suites.component').then(m => m.PrivateSuitesPageComponent)
          : import('./pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
        data: {
          suiteView: 'create',
          breadcrumb: [ NAVIGATION.home, NAVIGATION.suites, NAVIGATION.createSuite ],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
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
        path: '',
        providers: [provideApplicationOverviewFeature({ useBff: USE_CATALOG_BFF, apiUrl: API_BASE_URL }).providers],
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
              bottomBar: applicationBottomBar(NAVIGATION.applicationOverview),
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
            loadComponent: () => CATALOG_MODE === 'api'
              ? import('./pages/application-health-page/application-health-api-page.component').then(m => m.ApplicationHealthApiPageComponent)
              : import('./pages/application-health-page/application-health-page.component').then(m => m.ApplicationHealthPageComponent),
            resolve: {
              bottomBar: applicationBottomBar(NAVIGATION.applicationHealth),
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationSecondary: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.home, NAVIGATION.application, NAVIGATION.applicationHealth ],
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
            path: NAVIGATION.applicationDevLog.path + '/:version',
            loadComponent: () => USE_CATALOG_BFF
              ? import('./pages/releases/release-devlog.component').then(m => m.ReleaseDevlogPageComponent)
              : import('./pages/application-devlog-page/application-devlog-page.component').then(m => m.ApplicationDevlogPageComponent),
            resolve: {
              bottomBar: applicationBottomBar(NAVIGATION.applicationDevLog),
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationSecondary: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.home, NAVIGATION.application, NAVIGATION.applicationDevLog ],
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
            loadComponent: () => USE_CATALOG_BFF
              ? import('./pages/releases/release-devlog.component').then(m => m.ReleaseDevlogPageComponent)
              : import('./pages/application-devlog-page/application-devlog-page.component').then(m => m.ApplicationDevlogPageComponent),
            resolve: {
              bottomBar: applicationBottomBar(NAVIGATION.applicationDevLog),
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationSecondary: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.home, NAVIGATION.application, NAVIGATION.applicationDevLog ],
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
            loadComponent: () => USE_CATALOG_BFF
              ? import('./pages/application-reviews-page/application-reviews-api-page.component').then(m => m.ApplicationReviewsApiPageComponent)
              : import('./pages/application-reviews-page/application-reviews-page.component').then(m => m.ApplicationReviewsPageComponent),
            resolve: {
              bottomBar: applicationBottomBar(NAVIGATION.applicationReviews),
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationSecondary: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.home, NAVIGATION.application, NAVIGATION.applicationReviews ],
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
            loadComponent: () => USE_CATALOG_BFF
              ? import('./pages/application-reviews-page/application-reviews-api-page.component').then(m => m.ApplicationReviewsApiPageComponent)
              : import('./pages/application-reviews-page/application-reviews-page.component').then(m => m.ApplicationReviewsPageComponent),
            resolve: {
              bottomBar: applicationBottomBar(NAVIGATION.applicationReviews),
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug'),
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationSecondary: navigationResolver(DESKTOP_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.home, NAVIGATION.application, NAVIGATION.applicationReviews, NAVIGATION.applicationReview ],
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
            loadComponent: () => USE_CATALOG_BFF
              ? import('./pages/application-discussions-page/application-discussions-api-page.component').then(m => m.ApplicationDiscussionsApiPageComponent)
              : import('./pages/application-discussions-page/application-discussions-page.component').then(m => m.ApplicationDiscussionsPageComponent),
            resolve: {
              bottomBar: applicationBottomBar(NAVIGATION.applicationDiscussions),
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
            loadComponent: () => USE_CATALOG_BFF
              ? import('./pages/application-discussions-page/application-discussions-api-page.component').then(m => m.ApplicationDiscussionsApiPageComponent)
              : import('./pages/application-discussion-page/application-discussion-page.component').then(m => m.ApplicationDiscussionPageComponent),
            resolve: {
              bottomBar: applicationBottomBar(NAVIGATION.applicationDiscussions),
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
            loadComponent: () => USE_CATALOG_BFF
              ? import('./pages/application-timeline-page/application-timeline-api-page.component').then(m => m.ApplicationTimelineApiPageComponent)
              : import('./pages/application-timeline-page/application-timeline-page.component').then(m => m.ApplicationTimelinePageComponent),
            resolve: {
              bottomBar: applicationBottomBar(NAVIGATION.applicationTimeline),
              leftSidebar: sidebarResolver(ApplicationCommonSidebarComponent, {
                appSlug: (route: ActivatedRouteSnapshot) => route.paramMap.get('appSlug') ?? '',
                navigation: navigationResolver(APPLICATION_VIEW_MAIN_NAVIGATION),
                navigationAvatar: navigationResolver(NAVIGATION.applicationOverview)
              })
            },
            data: {
              breadcrumb: [ NAVIGATION.home, NAVIGATION.application, NAVIGATION.applicationTimeline ],
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
        path: NAVIGATION.discover.path,
        loadComponent: () => import('./pages/discover/discover-page.component').then(m => m.DiscoverPageComponent),
        data: {
          preload: true,
          breadcrumb: [NAVIGATION.home, NAVIGATION.discover],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
          },
          header: undefined,
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
          breadcrumb: [NAVIGATION.home, NAVIGATION.suites],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
          },
          header: undefined,
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
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/suite-publication/suite-publication.component').then(m => m.SuitePublicationPageComponent)
          : import('./pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
        data: {
          suiteMode: 'public',
          breadcrumb: [ NAVIGATION.home, NAVIGATION.suites, NAVIGATION.suite ],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
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
        loadComponent: () => import('./pages/favorites/favorites.component').then(m => m.FavoritesPageComponent),
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.favouriteSuites],
          favoriteKind: 'suites',
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
          },
          header: undefined,
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
          breadcrumb: [NAVIGATION.home, NAVIGATION.articles],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
          },
          header: undefined,
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
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/articles/article-catalog.component').then(m => m.ArticleCatalogPageComponent)
          : import('./pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.home, NAVIGATION.articles, NAVIGATION.article ],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
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
        path: NAVIGATION.favouriteArticles.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/favorites/favorites.component').then(m => m.FavoritesPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.favouriteArticles], favoriteKind: 'articles' },
      },
      ...(USE_CATALOG_BFF ? ([
        [APPLICATION_WORKSPACE_PATHS.articles, 'list'],
        [`${APPLICATION_WORKSPACE_PATHS.articles}/new`, 'new'],
        [`${APPLICATION_WORKSPACE_PATHS.articles}/:draftId`, 'edit'],
        [APPLICATION_WORKSPACE_PATHS.articleReviews, 'queue'],
        [`${APPLICATION_WORKSPACE_PATHS.articleReviews}/:draftId`, 'review'],
      ] as const).map(([path, articleMode]) => ({ path, canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/articles/article-workspace.component').then(m => m.ArticleWorkspacePageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.articles], articleMode },
      })) : []),
      ...(USE_CATALOG_BFF ? [{
        path: APPLICATION_WORKSPACE_PATHS.releases,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/releases/release-workspace.component').then(m => m.ReleaseWorkspacePageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications], releaseMode: 'list' },
      }, {
        path: `${APPLICATION_WORKSPACE_PATHS.releases}/new`,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/releases/release-workspace.component').then(m => m.ReleaseWorkspacePageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications], releaseMode: 'new' },
      }, {
        path: `${APPLICATION_WORKSPACE_PATHS.releases}/:draftId`,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/releases/release-workspace.component').then(m => m.ReleaseWorkspacePageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications], releaseMode: 'edit' },
      }, {
        path: APPLICATION_WORKSPACE_PATHS.releaseReviews,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/releases/release-workspace.component').then(m => m.ReleaseWorkspacePageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications], releaseMode: 'queue' },
      }, {
        path: `${APPLICATION_WORKSPACE_PATHS.releaseReviews}/:draftId`,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/releases/release-workspace.component').then(m => m.ReleaseWorkspacePageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications], releaseMode: 'review' },
      }, {
        path: APPLICATION_WORKSPACE_PATHS.claims,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-ownership/application-ownership.component').then(m => m.ApplicationOwnershipPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications], ownershipMode: 'list' },
      }, {
        path: `${APPLICATION_WORKSPACE_PATHS.claims}/:claimId`,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-ownership/application-ownership.component').then(m => m.ApplicationOwnershipPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications], ownershipMode: 'owner' },
      }, {
        path: APPLICATION_WORKSPACE_PATHS.ownershipReview,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-ownership/application-ownership.component').then(m => m.ApplicationOwnershipPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.applications], ownershipMode: 'queue' },
      }, {
        path: APPLICATION_WORKSPACE_PATHS.ownershipGrants,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-ownership/application-ownership.component').then(m => m.ApplicationOwnershipPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.applications], ownershipMode: 'grants' },
      }, {
        path: `${APPLICATION_WORKSPACE_PATHS.ownershipReview}/:claimId`,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-ownership/application-ownership.component').then(m => m.ApplicationOwnershipPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.applications], ownershipMode: 'review' },
      }, {
        path: `${APPLICATION_WORKSPACE_PATHS.editing}/:applicationId`,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-editing/application-editing.component').then(m => m.ApplicationEditingPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications] },
      }, {
        path: 'my/apps/:applicationId/publication',
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-publication/application-publication.component').then(m => m.ApplicationPublicationPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myApplications], publicationMode: 'owner' },
      }, {
        path: 'editorial/apps',
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-publication/application-publication.component').then(m => m.ApplicationPublicationPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.applications], publicationMode: 'queue' },
      }, {
        path: 'editorial/apps/:applicationId',
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/application-publication/application-publication.component').then(m => m.ApplicationPublicationPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.applications], publicationMode: 'review' },
      }, {
        path: 'my/suites/:suiteId/publication',
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/suite-publication/suite-publication.component').then(m => m.SuitePublicationPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.mySuites], suiteMode: 'owner' },
      }, {
        path: 'editorial/suites',
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/suite-publication/suite-publication.component').then(m => m.SuitePublicationPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.suites], suiteMode: 'queue' },
      }, {
        path: 'editorial/suites/:suiteId',
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/suite-publication/suite-publication.component').then(m => m.SuitePublicationPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.suites], suiteMode: 'review' },
      }, {
        path: 'my/suites/:suiteId',
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/private-suites/private-suites.component').then(m => m.PrivateSuitesPageComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.mySuites], suiteView: 'detail' },
      }] : []),
      {
        path: NAVIGATION.mySuites.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/private-suites/private-suites.component').then(m => m.PrivateSuitesPageComponent)
          : import('./pages/my-suites/my-suites.component').then(m => m.MySuitesPageComponent),
        data: { breadcrumb: [ NAVIGATION.home, NAVIGATION.mySuites ] },
      },
      {
        path: NAVIGATION.mefavouriteApplications.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/favorites/favorites.component').then(m => m.FavoritesPageComponent),
        data: { breadcrumb: [ NAVIGATION.home, NAVIGATION.mefavouriteApplications ], favoriteKind: 'applications' },
      },
      {
        path: NAVIGATION.myApplications.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/application-drafts/application-drafts.component').then(m => m.ApplicationDraftsPageComponent)
          : import('./pages/my-apps/my-apps.component').then(m => m.MyAppsPageComponent),
        data: { breadcrumb: [ NAVIGATION.home, NAVIGATION.myApplications ] },
      },

      {
        path: NAVIGATION.claimApplicationOwnership.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/application-ownership/application-ownership.component').then(m => m.ApplicationOwnershipPageComponent)
          : import('./pages/ownership/ownership.component').then(m => m.OwnershipPageComponent),
        data: { breadcrumb: [ NAVIGATION.home, NAVIGATION.claimApplicationOwnership ], ownershipMode: 'create' },
      },
      ...DISCOVER_REDIRECT_ROUTES,
      {
        path: NAVIGATION.tags.path,
        loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.home, NAVIGATION.tags ],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
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
        path: NAVIGATION.tag.path,
        loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
        data: {
          breadcrumb: [ NAVIGATION.home, NAVIGATION.tags, NAVIGATION.tag ],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
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
          breadcrumb: [ NAVIGATION.home, NAVIGATION.tags, NAVIGATION.tag, NAVIGATION.searchByTag ],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: { navigationPrimary: MOBILE_MAIN_NAVIGATION }
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
          breadcrumb: [ NAVIGATION.home, NAVIGATION.categories ],
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
        },
        loadComponent: () => import('./pages/category-results-page/category-results-page.component').then(m => m.CategoryResultsPageComponent),
      },
      {
        path: NAVIGATION.category.path,
        data: {
          breadcrumb: [ NAVIGATION.home, NAVIGATION.category ],
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
          breadcrumb: [ NAVIGATION.home, NAVIGATION.searchByCategory ],
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
        path: NAVIGATION.profileBadges.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/profile-badge-admin/profile-badge-admin.component').then(m => m.ProfileBadgeAdminComponent),
        data: { breadcrumb: [NAVIGATION.home, NAVIGATION.myProfile] },
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
        resolve: { bottomBar: contextBottomBar(PROFILE_VIEW_MAIN_NAVIGATION, NAVIGATION.overview) },
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.myProfile],
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
        resolve: { bottomBar: contextBottomBar(PROFILE_VIEW_MAIN_NAVIGATION, NAVIGATION.myFavorite) },
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.myFavorite],
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
        path: NAVIGATION.notifications.path,
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsPageComponent),
        resolve: { bottomBar: contextBottomBar(PROFILE_VIEW_MAIN_NAVIGATION, NAVIGATION.notifications) },
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.notifications],
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
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/my-discussions/my-discussions-api-page.component').then(m => m.MyDiscussionsApiPageComponent)
          : import('./pages/my-discussions/my-discussions.component').then(m => m.MyDiscussionsPageComponent),
        resolve: { bottomBar: contextBottomBar(PROFILE_VIEW_MAIN_NAVIGATION, NAVIGATION.myProfile) },
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.myDiscussions],
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
        canActivate: USE_CATALOG_BFF ? [] : [AuthenticationGuard],
        loadComponent: () => USE_CATALOG_BFF
          ? import('./pages/profile-page/public-profile-page.component').then(m => m.PublicProfilePageComponent)
          : import('./pages/profile-page/profile-page.component').then(m => m.ProfilePageComponent),
        resolve: {
          bottomBar: contextBottomBar(PUBLIC_PROFILE_VIEW_MAIN_NAVIGATION, NAVIGATION.userProfile),
          leftSidebar:
            sidebarResolver(CommonSidebarComponent, {
              avatarPath: profileAvatarResolver(),
              navigation: DESKTOP_USER_MAIN_NAVIGATION
            })
        },
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.myProfile],

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
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsPageComponent),
        canActivate: [AuthenticationGuard],
        data: {
          breadcrumb: [NAVIGATION.home, NAVIGATION.settings],
          bottomBar: {
            component: CommonMobileBottomBarPartialComponent,
            inputs: {
              navigationPrimary: [...PROFILE_VIEW_MAIN_NAVIGATION, NAVIGATION.explore],
              navigationActive: NAVIGATION.settings,
            },
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
      size: 's',
      appearance: 'authentication',
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
  // OAuth callback route for third-party authentication
  {
    path: 'auth/callback',
    component: OAuthCallbackComponent
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundPageComponent)
  }

];

// Digest shares the catalog shell, with its own portal overview content.
const portalRoutes = routes[0].children!;
const articleListingRoute = portalRoutes.find(route => route.path === NAVIGATION.articles.path)!;
portalRoutes.unshift(
  {
    ...articleListingRoute,
    path: NAVIGATION.digest.path,
    loadComponent: () => USE_CATALOG_BFF
      ? import('./pages/digest/digest-api-page.component').then(m => m.DigestApiPageComponent)
      : import('./pages/digest/digest-page.component').then(m => m.DigestPageComponent),
    data: { ...articleListingRoute.data, header: { component: HeaderPartialComponent }, breadcrumb: [NAVIGATION.home, NAVIGATION.digest] },
  },
);

// Every portal page keeps a way back to discovery and an accessible mobile account menu.
const defaultShell = portalRoutes.find(route => route.path === NAVIGATION.home.path && route.loadComponent)!.data!;
function completeShellDefaults(items: Routes, parentData = defaultShell): void {
  for (const route of items) {
    const pageData = { ...parentData, ...route.data };
    if (route.loadComponent || route.component) {
      route.data = pageData;
    }
    if (route.children) completeShellDefaults(route.children, pageData);
  }
}
completeShellDefaults(portalRoutes);
