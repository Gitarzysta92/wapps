import { InputSignal } from '@angular/core';

/**
 * Utility type that transforms a route data interface into a component contract
 * requiring matching signal inputs. Use with `withComponentInputBinding()`.
 * 
 * @example
 * interface IMyRouteData {
 *   user: UserDto;
 *   breadcrumb: NavigationDeclarationDto[];
 * }
 * 
 * class MyComponent implements routingDataConsumerFrom<IMyRouteData> {
 *   user = input.required<UserDto>();
 *   breadcrumb = input.required<NavigationDeclarationDto[]>();
 * }
 */
export type routingDataConsumerFrom<T> = {
  [K in keyof T]: InputSignal<T[K]>;
};
