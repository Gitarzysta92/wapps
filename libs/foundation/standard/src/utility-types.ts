export type AddTypeToArray<T extends readonly unknown[], U> = {
  [K in keyof T]: T[K] & U;
};