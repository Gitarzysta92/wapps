import { Routes } from "@angular/router";
import { AppShellComponent } from "./shells/app-shell/app-shell.component";
import { NAVIGATION } from "./navigation";
import { HeaderPartialComponent } from "./partials/header/header.component";
import { FooterPartialComponent } from "./partials/footer/footer.component";
import { IAppShellRouteData } from "./shells/app-shell/app-shell.component";
import { OAuthCallbackComponent } from "@portals/shared/features/identity";

export const routes: Routes = [
  // OAuth callback route for third-party authentication (must be before the shell route)
  {
    path: "auth/callback",
    component: OAuthCallbackComponent,
  },
  {
    path: "",
    component: AppShellComponent,
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: NAVIGATION.discussions.path,
      },
      {
        path: NAVIGATION.discussions.path,
        loadComponent: () =>
          import("./pages/discussions/discussions-page.component").then(
            (m) => m.DiscussionsPageComponent
          ),
        data: {
          header: {
            component: HeaderPartialComponent,
          },
          footer: {
            component: FooterPartialComponent,
          },
        } as IAppShellRouteData,
      },
      {
        path: NAVIGATION.discussion.path,
        loadComponent: () =>
          import("./pages/discussion/discussion-page.component").then(
            (m) => m.DiscussionPageComponent
          ),
        data: {
          header: {
            component: HeaderPartialComponent,
          },
          footer: {
            component: FooterPartialComponent,
          },
        } as IAppShellRouteData,
      },
      {
        path: "login",
        loadComponent: () =>
          import("@portals/shared/features/identity").then(
            (m) => m.LoginContainerComponent
          ),
        data: {
          header: {
            component: HeaderPartialComponent,
          },
          footer: {
            component: FooterPartialComponent,
          },
        } as IAppShellRouteData,
      },
      {
        path: "**",
        redirectTo: NAVIGATION.discussions.path,
      },
    ],
  },
];

