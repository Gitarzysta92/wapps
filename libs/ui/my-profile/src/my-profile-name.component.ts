import { Component, inject } from "@angular/core";
import { MyProfileService } from "../../../application";
import { filter, map } from "rxjs";
import { AsyncPipe } from "@angular/common";

@Component({
  selector: "[my-profile-name]",
  templateUrl: 'my-profile-name.component.html',
  imports: [
    AsyncPipe
  ]
})
export class MyProfileNameComponent {
  public readonly profileName$ = inject(MyProfileService).profile$
    .pipe(
      filter(r => 'name' in r),
      map(r => r.name)
    );
}