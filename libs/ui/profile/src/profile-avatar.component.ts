import { Component, input } from "@angular/core";
import { TuiAvatar } from "@taiga-ui/kit";

@Component({
  selector: "[profile-avatar]",
  template: `
    <tui-avatar size="xl" tuiAvatarOutline="var(--tui-background-accent-2)">
      @if (avatarPath()) {
        <img [src]="avatarPath()" alt="Profile avatar" />
      }
    </tui-avatar>
  `,
  styles: `
    :host {
      display: flex;
      justify-content: center;
    }
    tui-avatar { 
      border: 2px solid var(--tui-border-normal); 
    }
  `,
  standalone: true,
  imports: [TuiAvatar]
})
export class ProfileAvatarComponent {
  public readonly avatarPath = input<string>();
}

