import { Result } from '@sdk/kernel/standard';
import { AuthSessionDto } from "../models/auth-session.dto";

export interface IAuthenticationRefreshToken {
  refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>>;
}