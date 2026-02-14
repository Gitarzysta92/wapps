import { Result } from '@foundation/standard';
import { AuthSessionDto } from "../models/auth-session.dto";

export interface IAuthenticationRefreshToken {
  refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>>;
}