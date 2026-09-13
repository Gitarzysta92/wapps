import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
export type ClientIdentityDto = { id: string; name: string };
export interface IClientIdentityProvider { getIdentity(): Observable<Result<ClientIdentityDto, Error>>; }
