import { Observable } from 'rxjs';
import type { ReleaseDto } from '../models/release.dto';

export interface ReleaseManagerPort {
  createRelease(release: Omit<ReleaseDto, 'id'>): Observable<ReleaseDto>;
  updateRelease(id: string, release: Partial<ReleaseDto>): Observable<ReleaseDto>;
  deleteRelease(id: string): Observable<void>;
  publishRelease(id: string): Observable<ReleaseDto>;
  archiveRelease(id: string): Observable<ReleaseDto>;
}
