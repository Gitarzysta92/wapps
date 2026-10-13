import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { CategoryDto } from './category.dto';

export interface ICategoriesProvider {
  getCategories(): Observable<Result<CategoryDto[], Error>>;
}
