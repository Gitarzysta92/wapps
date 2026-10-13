import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { TagDto } from '../models/tag.dto';

export interface ITagsProvider {
  getTags(): Observable<Result<TagDto[], Error>>;
}
