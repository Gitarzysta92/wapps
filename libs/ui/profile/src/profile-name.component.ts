import { Component, input } from "@angular/core";

@Component({
  selector: "[profile-name]",
  template: `<span class="profile-name">{{ name() }}</span>`,
  styles: `
    .profile-name {
      font-weight: 500;
      font-size: 1rem;
      color: var(--tui-text-primary);
    }
  `,
  standalone: true,
  imports: []
})
export class ProfileNameComponent {
  public readonly name = input<string>();
}



