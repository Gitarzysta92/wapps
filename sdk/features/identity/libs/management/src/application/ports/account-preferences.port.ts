import type {
  AccountPreferences,
  PreferencesUpdate,
  PreferencesUpdateReceipt,
} from '@domains/customer/preferences';

export interface AccountPreferencesStore {
  getPreferences(identityId: string): Promise<AccountPreferences>;
  updatePreferences(
    identityId: string,
    input: PreferencesUpdate,
    key: string
  ): Promise<PreferencesUpdateReceipt>;
}
