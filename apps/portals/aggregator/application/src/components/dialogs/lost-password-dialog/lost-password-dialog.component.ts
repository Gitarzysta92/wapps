import { Component } from "@angular/core";
import { TuiLink } from "@taiga-ui/core";
import { PasswordResetRequestContainer } from "@ui/password-reset";
import { RoutedDialogButton } from "@ui/routable-dialog";

@Component({
  templateUrl: "lost-password-dialog.component.html",
  standalone: true,
  styles: '',
  imports: [
    RoutedDialogButton,
    TuiLink,
    PasswordResetRequestContainer
  ]
})
export class LostPasswordDialogComponent {

}