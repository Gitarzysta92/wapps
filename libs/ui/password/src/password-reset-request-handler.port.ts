import { Observable } from 'rxjs';
import { PasswordResetRequestDto } from './password-reset-request.dto';

export interface PasswordResetRequestHandlerPort {
  requestPasswordReset(data: PasswordResetRequestDto): Observable<{ value?: boolean; error?: Error }>;
}
