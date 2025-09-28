import { Component } from "@angular/core";
import { TuiLink } from "@taiga-ui/core";
import { RoutedDialogButton } from "@ui/routable-dialog";
import { RegistrationContainerComponent } from "@portals/shared/features/identity";


@Component({
  templateUrl: "registration-dialog.component.html",
  host: { 'data-component-id': 'registration-dialog' },
  imports: [
    RoutedDialogButton,
    TuiLink,
    RegistrationContainerComponent
  ]
})
export class RegistrationDialogComponent {

}