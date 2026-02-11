import { AuthenticationProvider } from './authentication-provider.enum';

export type AuthenticationMethodDto = {
  provider: AuthenticationProvider;
  displayName: string;
  icon?: string;
  enabled: boolean;
  /**
   * Optional URL (BFF) to start an OAuth flow.
   * Backends may include it; UIs can use it when present.
   */
  authUrl?: string;
};

