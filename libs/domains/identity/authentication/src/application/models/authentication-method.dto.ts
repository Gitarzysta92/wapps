import { AuthenticationProvider } from './authentication-provider.enum';

export type AuthenticationMethodDto = {
  provider: AuthenticationProvider;
  displayName: string;
  icon?: string;
  enabled: boolean;
};

