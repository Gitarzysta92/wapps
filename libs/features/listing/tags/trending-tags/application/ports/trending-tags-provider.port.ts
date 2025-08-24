import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "../../../../../../utils/utility-types";
import { TrendingTagDto } from "../models";

export const TRENDING_TAGS_PROVIDER = new InjectionToken<ITrendingTagsProvider>('TRENDING_TAGS_PROVIDER');

export interface ITrendingTagsProvider {
  getTrendingTags(): Observable<Result<TrendingTagDto[], Error>>;
}

