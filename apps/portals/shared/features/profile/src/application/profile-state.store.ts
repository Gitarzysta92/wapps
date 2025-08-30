import { inject, Injectable } from "@angular/core";
import { switchMap } from "rxjs";
import { IProfileApiService } from "./ports/profile-api-service.port";
import { IdentityDto } from "./models/identity.dto";

@Injectable()
export abstract class ProfileStateStore {

  public get state() { return this._state$.value };
  private readonly _profileProvider = inject(IProfileApiService);

  public state$ = this._profileProvider.getProfile("default").pipe(
    switchMap(profile => this._profileProvider.getProfile(profile.id))
  );
}