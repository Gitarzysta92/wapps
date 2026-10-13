import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { PlatformOptionDto } from '../models/platform-option.dto';

export interface IPlatformOptionProvider {
  getPlatformOptions(): Observable<Result<PlatformOptionDto[], Error>>;
}
