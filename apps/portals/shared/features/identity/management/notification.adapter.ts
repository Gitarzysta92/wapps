import { Injectable } from "@angular/core";
import { IIdentityManagementEventListener } from "../../../../../../libs/features/identity/management/application/ports";

@Injectable()
export class IdentityNotificationsService implements IIdentityManagementEventListener {

  // getIdentity(): Observable<Result<, Error>> {
  //   throw new Error("Method not implemented.");
  // }

  // private readonly _authenticationService = inject(AuthenticationService);
  // private readonly _authenticationLocalStorage = inject(AuthenticationStorage);
  
  // public async getIdentity(): Promise<IdentityDto | null> {
  //   return this._authenticationLocalStorage.getToken<IdentityDto>() ?? null;
  // }

  // public async authenticate(c: CredentialsDto): Promise<Result<IdentityDto, Error>> {
  //   return await this._authenticationService.authenticate<IdentityDto>(c);
  // }

  // public unauthenticate(): void {
  //   this._authenticationLocalStorage.clear();
  // }
}