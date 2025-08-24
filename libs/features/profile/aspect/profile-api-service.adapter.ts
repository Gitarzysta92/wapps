import { inject, Injectable } from "@angular/core";
import { AuthenticationService } from "../../../aspects/authentication/application";
import { IProfileApiService } from "../application/ports/profile-api-service.port";


@Injectable()
export class ProfileAuthentication implements IProfileApiService {

  private readonly _token$ = inject(AuthenticationService).token$;

  
}