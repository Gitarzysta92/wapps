import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { CustomerProfileDto } from '../models/profile.dto';

export interface IMyProfileProvider {
  getMyProfile(): Observable<Result<CustomerProfileDto>>;
}
