import { Component, inject } from "@angular/core";
import { map } from "rxjs";
import { AsyncPipe } from "@angular/common";
import { MY_PROFILE_STATE_PROVIDER } from "../../application/my-profile-state-provider.token";

@Component({
  selector: "[my-profile-name]",
  templateUrl: 'my-profile-name.component.html',
  imports: [
    AsyncPipe
  ]
})
export class MyProfileNameComponent {
  public readonly profileName$ = inject(MY_PROFILE_STATE_PROVIDER) .myProfile$.pipe(
    map(r => r.data.name)
  );
}