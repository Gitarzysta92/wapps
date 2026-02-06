import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/services-directory/services-directory-page.component').then(
        (m) => m.ServicesDirectoryPageComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

