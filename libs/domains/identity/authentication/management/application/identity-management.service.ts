import { inject, Injectable } from "@angular/core";
import { EVENT_LISTENER, IDENTITY_PROVIDER, IDENTITY_UPDATER } from "./ports";

@Injectable()
export class IdentityManagementService {
  private readonly _eventListener = inject(EVENT_LISTENER);
  private readonly _identityProvider = inject(IDENTITY_PROVIDER);
  private readonly _identityUpdater = inject(IDENTITY_UPDATER);

  
}