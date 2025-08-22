import { Component } from "@angular/core";
import { TuiLink } from "@taiga-ui/core";
import { RoutedDialogButton } from "../../../../../libs/ui/directives/identity-routed-dialog-button.directive";
import { RegistrationContainerComponent } from "../../../../../libs/features/identity/registration/presentation/registration-container";

@Component({
  templateUrl: "registration-dialog.component.html",
  host: { 'data-component-id': 'registration-dialog' },
  imports: [
    RegistrationContainerComponent,
    RoutedDialogButton,
    TuiLink
  ]
})
export class RegistrationDialogComponent {

}