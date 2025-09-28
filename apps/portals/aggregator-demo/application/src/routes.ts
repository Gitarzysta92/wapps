import { ActivatedRouteSnapshot, createUrlTreeFromSnapshot, Router, Routes } from "@angular/router";


import { tuiGenerateDialogableRoute } from "@taiga-ui/kit";

import { AuthenticationDialogComponent } from "./dialogs/authentication-dialog/authentication-dialog.component";
import { LostPasswordDialogComponent } from "./dialogs/lost-password-dialog/lost-password-dialog.component";
import { RegistrationDialogComponent } from "./dialogs/registration-dialog/registration-dialog.component";
import { HomePageComponent } from "./pages/home/home.component";
import { RoutableDialogComponent } from "@ui/routable-dialog";
import { AppShellComponent } from "./shells/app-shell/app-shell.component";
import { ChatBannerComponent } from "./partials/chat/chat-banner.component";


import { FILTERS } from "./filters";
import { NAVIGATION } from "./navigation";
import { AuthenticationGuard } from "@portals/shared/features/identity";
import { inject } from "@angular/core";

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home',
        // redirectTo: () => inject(Router).createUrlTree([
        //   '',
        //   {
        //     outlets: {
        //       primary: ['home'],
        //     },
        //   },
        // ]),
      },
      { path: '', outlet: 'header', component: ChatBannerComponent },
      {
        path: 'home',
        component: HomePageComponent,
        data: { breadcrumb: 'Home' },
      },
      {
        path: 'results/page/:page',
        loadComponent: () => import('./pages/search-results-page/search-results-page.component').then(m => m.SearchResultsPageComponent),
      },
      {
        path: `${NAVIGATION.tags.path}/:${FILTERS.tag}/page/:page`,
        loadComponent: () => import('./pages/tag-results-page/tag-results-page.component').then(m => m.TagResultsPageComponent),
      },
      {
        path: `${NAVIGATION.categories.path}/:${FILTERS.category}/page/:page`,
        loadComponent: () => import('./pages/category-results-page/category-results-page.component').then(m => m.CategoryResultsPageComponent),
      },
        
      // {
      //   path: ':entrySlug',
      //   loadComponent: () => import('./components/pages/entry-details-page/entry-details-page.component').then(m => m.EntryDetailsPageComponent),
      // },
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
        path: 'settings',
        canActivate: [AuthenticationGuard],
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.HomePageComponent),
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