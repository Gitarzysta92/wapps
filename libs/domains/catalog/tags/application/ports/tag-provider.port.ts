import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "../../../../../../utils/utility-types";
import { TagDto } from "../models";

export const TAGS_PROVIDER = new InjectionToken<ITagsProvider>('TAGS_PROVIDER_PORT');

export interface ITagsProvider {
  getTags(): Observable<Result<TagDto[], Error>>;
}

