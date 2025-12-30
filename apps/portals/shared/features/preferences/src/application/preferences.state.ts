import { CustomerPreferencesDto } from '@domains/customer/preferences';

export interface PreferencesState {
  isLoading: boolean;
  isError: boolean;
  data: CustomerPreferencesDto;
}

