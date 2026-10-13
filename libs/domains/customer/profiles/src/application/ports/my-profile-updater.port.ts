import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { CustomerProfileDto } from '../models/profile.dto';

export interface IMyProfileUpdater {
  update(p: CustomerProfileDto): Observable<Result<boolean, Error>>;
}
