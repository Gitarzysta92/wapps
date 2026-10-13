import { Observable } from 'rxjs';

export interface IAuthenticationProvider {
  isAuthenticated$: Observable<boolean>;
}
