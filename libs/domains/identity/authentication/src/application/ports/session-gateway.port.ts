import { Result } from '@foundation/standard';
import { AuthSessionDto } from '../models/auth-session.dto';

export interface ISessionGateway {
  signInWithPassword(email: string, password: string): Promise<Result<AuthSessionDto, Error>>;
  signUpAnonymous(): Promise<Result<AuthSessionDto, Error>>;
  signInWithCustomToken(customToken: string): Promise<Result<AuthSessionDto, Error>>;
  refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>>;
}

