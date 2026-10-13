import { Observable } from 'rxjs';
import { OwnerDto } from '@domains/catalog/ownership';

export interface IProfileApiService {
  getProfile(id: string): Observable<OwnerDto>;
  updateProfile(profile: OwnerDto): Observable<boolean>;
}
