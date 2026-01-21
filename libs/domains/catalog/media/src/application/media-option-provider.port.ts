import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { MediaOptionDto } from "./media-option.dto";

export interface IMediaOptionProvider {
  getMediaOptions(): Observable<Result<MediaOptionDto[], Error>>;
}
