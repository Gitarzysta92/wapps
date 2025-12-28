import { Observable } from 'rxjs';
import type { ReleaseDto } from '../models/release.dto';

export interface ReleaseProviderPort {
  getRelease(appId: string, version: string): Observable<ReleaseDto>;
  getReleasesByApp(appId: string): Observable<ReleaseDto[]>;
  getLatestRelease(appId: string): Observable<ReleaseDto>;
  getPublishedReleases(appId: string): Observable<ReleaseDto[]>;
}
