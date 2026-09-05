import { ResolveFn } from "@angular/router";
import { NavigationDeclarationDto, buildRoutePath } from "@portals/shared/boundary/navigation";

export const navigationResolver:
  (
    navigation: NavigationDeclarationDto[] | NavigationDeclarationDto
  ) => ResolveFn<NavigationDeclarationDto[] | NavigationDeclarationDto> =
  (navigation) => (route) => {
  const params = route.params as Record<string, string>;
  
  if (Array.isArray(navigation)) {
    return navigation.map(breadcrumb => ({
      ...breadcrumb,
      path: buildRoutePath(breadcrumb.path, params, { absolute: true })
    }));
  }
  else {
    return {
      ...navigation,
      path: buildRoutePath(navigation.path, params, { absolute: true })
    };
  }
};

