import { Observable } from "rxjs";
import { Result } from "@standard";
import { CategoryDto } from "./category.dto";

export interface ICategoriesProvider {
  getCategories(): Observable<Result<CategoryDto[], Error>>;
}

