import { Component } from "@angular/core";
import { TuiLink } from "@taiga-ui/core";
import { PasswordResetRequestContainer } from "../../../../../libs/features/identity/password-reset-request/presentation/password-reset-request-container/password-reset-request-container.component";
import { RoutedDialogButton } from "../../../../../libs/ui/directives/identity-routed-dialog-button.directive";

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