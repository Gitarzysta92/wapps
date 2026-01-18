import { Routes } from "@angular/router";
import { AppShellComponent } from "./shells/app-shell/app-shell.component";
import { NAVIGATION } from "./navigation";
import { HeaderPartialComponent } from "./partials/header/header.component";
import { FooterPartialComponent } from "./partials/footer/footer.component";
import { IAppShellRouteData } from "./shells/app-shell/app-shell.component";

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: NAVIGATION.catalog.path,
      },
      {
        path: NAVIGATION.catalog.path,
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomePageComponent),
        data: {
          header: {
            component: HeaderPartialComponent,
          },
          footer: {
            component: FooterPartialComponent,
          }
        } as IAppShellRouteData,
      },
      {
        path: NAVIGATION.appDetails.path,
        loadComponent: () => import('./pages/app-details/app-details.component').then(m => m.AppDetailsPageComponent),
        data: {
          header: {
            component: HeaderPartialComponent,
          },
          footer: {
            component: FooterPartialComponent,
          }
        } as IAppShellRouteData,
      },
      {
        path: '**',
        redirectTo: NAVIGATION.catalog.path
      }
    ]
  }
];
