import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { TagOptionDto } from '../models/tag-option.dto';

export interface ITagOptionProvider {
  getTagOptions(): Observable<Result<TagOptionDto[], Error>>;
}
