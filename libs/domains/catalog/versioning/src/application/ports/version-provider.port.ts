import { Observable } from 'rxjs';
import type { AppVersionDto } from '../models/app-version.dto';

export interface VersionProviderPort {
  getVersions(appId: string): Observable<AppVersionDto[]>;
  getLatestVersion(appId: string): Observable<AppVersionDto>;
  compareVersions(version1: string, version2: string): number;
}
