import { Component, input } from "@angular/core";

@Component({
  selector: "[my-profile-name]",
  templateUrl: 'my-profile-name.component.html',
  imports: []
})
export class MyProfileNameComponent {
  public readonly profileName = input<string>();
}