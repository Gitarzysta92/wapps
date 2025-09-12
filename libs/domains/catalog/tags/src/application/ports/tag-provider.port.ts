import { Observable } from "rxjs";
import { Result } from "@standard";
import { TagDto } from "../models/tag.dto";



export interface ITagsProvider {
  getTags(): Observable<Result<TagDto[], Error>>;
}

