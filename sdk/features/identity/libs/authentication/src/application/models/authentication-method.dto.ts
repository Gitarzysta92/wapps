import { AuthenticationProvider } from './authentication-provider';

export interface AuthenticationMethodDto {
  provider: AuthenticationProvider;
  displayName: string;
  enabled: boolean;
  icon?: string;
}

