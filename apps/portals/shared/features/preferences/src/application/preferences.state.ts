import { CustomerPreferencesDto } from '@domains/customer/preferences';
import type { PreferencesEditContext } from './preferences-session.port';

export interface PreferencesState {
  isLoading: boolean;
  isError: boolean;
  data: CustomerPreferencesDto;
  scope: 'account' | 'guest' | 'demo';
  sessionKey: string | null;
  sessionVersion: number;
  context: PreferencesEditContext | null;
}
