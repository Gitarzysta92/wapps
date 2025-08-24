import { inject, Injectable } from "@angular/core";
import { AuthenticationService } from "../../../aspects/authentication/application";
import { map, Observable } from "rxjs";
import { IAuthenticationProvider } from "../application/ports";

@Injectable()
export class AuthenticationAdapter implements IAuthenticationProvider {
  
  public isAuthenticated$: Observable<boolean> = inject(AuthenticationService).token$
    .pipe(map(p => !!p))

}