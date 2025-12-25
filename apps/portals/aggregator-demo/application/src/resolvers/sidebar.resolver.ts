import { Signal, Type } from "@angular/core";
import { ResolveFn } from "@angular/router";


export const sidebarResolver:
  (
    component: Type<unknown>,
    inputs: Record<string, unknown | Signal<unknown> | ResolveFn<unknown>>
  ) => ResolveFn<{
    component: Type<unknown>,
    inputs: Record<string, unknown | Signal<unknown>>
  }> =
  (component, inputs) => (route, state) => {  
    return {
      component,
      inputs: Object.fromEntries(Object.entries(inputs).map(([key, value]) => [
        key,
        typeof value === 'function' ? value(route, state) : value
      ]))
    }
  };