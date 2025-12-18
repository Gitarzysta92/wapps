export type ProviderState<T> = {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
};


