import { ResolveFn } from '@angular/router';

export type resolversFrom<T> = {
  [K in keyof T]: ResolveFn<T[K]>;
};
