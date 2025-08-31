import { Component } from "@angular/core";
import { TuiLink } from "@taiga-ui/core";
import { RoutedDialogButton } from "@ui/routable-dialog";
import { RegistrationContainerComponent } from "@ui/registration";

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