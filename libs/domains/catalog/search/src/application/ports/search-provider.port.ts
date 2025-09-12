import { Observable } from "rxjs";
import { SearchCriteriaDto } from "../models/search-criteria.dto";
import { Result } from "@standard";

export interface ISearchProvider {
  search(c: SearchCriteriaDto): Observable<Result<boolean, Error>>;
}