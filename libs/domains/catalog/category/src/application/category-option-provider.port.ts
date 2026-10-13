import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { CategoryOptionDto } from './category-option.dto';

export interface ICategoryOptionProvider {
  getCategoryOptions(): Observable<Result<CategoryOptionDto[], Error>>;
}
