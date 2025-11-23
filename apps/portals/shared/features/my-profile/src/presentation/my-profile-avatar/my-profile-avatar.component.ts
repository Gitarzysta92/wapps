import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { TuiAvatar, TuiBadgedContent } from "@taiga-ui/kit";
import { map } from "rxjs";
import { MY_PROFILE_STATE_PROVIDER } from "../../application/my-profile-state-provider.token";

@Component({
  selector: "[my-profile-avatar]",
  templateUrl: 'my-profile-avatar.component.html',
  styles: `tui-avatar { border: 2px solid }`,
  imports: [
    AsyncPipe,
    TuiBadgedContent,
    TuiAvatar
  ]
})
export class MyProfileAvatarComponent {

  public readonly avatarPath$ = inject(MY_PROFILE_STATE_PROVIDER) .myProfile$.pipe(
    map(r => r.data.avatarUrl as string));
}