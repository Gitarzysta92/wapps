import { Observable } from "rxjs";
import { Result } from "@standard";
import { CategoryDto } from "./category.dto";

export interface ICategoriesProvider {
  getCategries(): Observable<Result<CategoryDto[], Error>>;
}

