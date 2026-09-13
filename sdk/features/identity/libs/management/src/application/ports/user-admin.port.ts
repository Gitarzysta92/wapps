import { Result } from '@sdk/kernel/standard';
import { UserUpdateDto } from '../models/user-update.dto';

export interface IUserAdminPort {
  updateUser(uid: string, patch: UserUpdateDto): Promise<Result<boolean, Error>>;
  revokeRefreshTokens(uid: string): Promise<Result<boolean, Error>>;
  deleteUser(uid: string): Promise<Result<boolean, Error>>;

  generatePasswordResetLink(email: string): Promise<Result<string, Error>>;
  generateEmailVerificationLink(email: string): Promise<Result<string, Error>>;
}

