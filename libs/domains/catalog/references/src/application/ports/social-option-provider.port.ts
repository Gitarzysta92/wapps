import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { SocialOptionDto } from '../models/social-option.dto';

export interface ISocialOptionProvider {
  getSocialOptions(): Observable<Result<SocialOptionDto[], Error>>;
}
