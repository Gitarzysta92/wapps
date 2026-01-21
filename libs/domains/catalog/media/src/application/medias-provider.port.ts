import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { MediaDto } from "./media.dto";

export interface IMediasProvider {
  getMedias(): Observable<Result<MediaDto[], Error>>;
}
