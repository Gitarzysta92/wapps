import { Observable } from 'rxjs';
import { ContentAttributionDto } from '../models/content-attribution.dto';

export interface IAttributionProvider {
  getAttribution(contentId: string): Observable<ContentAttributionDto | null>;
}
