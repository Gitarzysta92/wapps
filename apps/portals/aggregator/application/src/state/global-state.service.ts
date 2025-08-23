import { BehaviorSubject, filter, map } from "rxjs";
import { inject, Injectable } from "@angular/core";
import { NavigationStart, Router } from "@angular/router";

@Injectable()
export class GlobalStateService {
  //private readonly _identityStateService = inject(IdentityStateStore);
  private readonly _router = inject(Router);

  constructor() {
    this._router.events
      .pipe(filter(e => e instanceof NavigationStart))
      .subscribe(e => {
        this.closeUserPanel();
    })
  }


  userNotifications$ = new BehaviorSubject(2);
  userPanelOpen$ = new BehaviorSubject(false);
  userAvatarUrl: string = 'asd';

  //user$ = this._identityStateService.state$.pipe(map(s => s.identity))

  toggleUserPanel(): void {
    this.userPanelOpen$.next(!this.userPanelOpen$.value);
  }

  closeUserPanel(): void {
    this.userPanelOpen$.next(false);
  }

}