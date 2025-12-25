import { ResolveFn } from "@angular/router";
import { NavigationDeclarationDto, buildRoutePath } from "@portals/shared/boundary/navigation";

export const navigationResolver: (navigation: NavigationDeclarationDto[]) => ResolveFn<NavigationDeclarationDto[]> = (breadcrumbs) => (route) => {
  const params = route.params as Record<string, string>;
  
  return breadcrumbs.map(breadcrumb => ({
    ...breadcrumb,
    path: buildRoutePath(breadcrumb.path, params, { absolute: true })
  }));
};

