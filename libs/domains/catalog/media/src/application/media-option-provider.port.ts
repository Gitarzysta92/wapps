import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { MediaOptionDto } from './media-option.dto';

export interface IMediaOptionProvider {
  getMediaOptions(): Observable<Result<MediaOptionDto[], Error>>;
}
