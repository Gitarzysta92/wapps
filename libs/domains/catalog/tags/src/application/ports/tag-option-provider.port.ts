import { Observable } from "rxjs";
import { Result } from "@standard";
import { TagOptionDto } from "../models/tag-option.dto";

export interface ITagOptionProvider {
  getTagOptions(): Observable<Result<TagOptionDto[], Error>>;
}


