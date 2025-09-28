import { Component } from "@angular/core";
import { TuiLink } from "@taiga-ui/core";
import { RoutedDialogButton } from "@ui/routable-dialog";
import { PasswordResetRequestContainerComponent } from "@portals/shared/features/identity";


@Component({
  templateUrl: "lost-password-dialog.component.html",
  standalone: true,
  styles: '',
  imports: [
    RoutedDialogButton,
    TuiLink,
    PasswordResetRequestContainerComponent
  ]
})
export class LostPasswordDialogComponent {

}