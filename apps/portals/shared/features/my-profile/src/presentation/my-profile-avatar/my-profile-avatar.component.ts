import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { TuiAvatar, TuiBadgedContent } from "@taiga-ui/kit";
import { MyProfileService } from "../../../application/my-profile.service";
import { map, tap } from "rxjs";

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

  public readonly avatarPath$ = inject(MyProfileService).profile$
    .pipe(map(r => r.avatarUrn as string));
}