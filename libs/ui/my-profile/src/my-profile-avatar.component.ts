import { Component, input } from "@angular/core";
import { TuiAvatar, TuiBadgedContent } from "@taiga-ui/kit";

@Component({
  selector: "[ui-my-profile-avatar]",
  templateUrl: 'my-profile-avatar.component.html',
  styles: `tui-avatar { border: 2px solid }`,
  imports: [
    TuiBadgedContent,
    TuiAvatar
  ]
})
export class MyProfileAvatarComponent {

  public readonly avatarPath = input<string | null>(null);
}