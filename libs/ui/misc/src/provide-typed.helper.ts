import { InjectionToken, Type, Provider } from "@angular/core";

export function provideTypedClass<T>(
  token: InjectionToken<T>,
  useClass: Type<T>
): Provider {
  return { provide: token, useClass };
}