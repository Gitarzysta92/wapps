import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { CategoryDto } from "../models/category.dto";
import { Result } from "../../../../../../utils/utility-types";

export const CATEGORIES_PROVIDER = new InjectionToken<ICategoriesProvider>('CATEGORIES_PROVIDER');

export interface ICategoriesProvider {
  getCategries(): Observable<Result<CategoryDto[], Error>>;
}

