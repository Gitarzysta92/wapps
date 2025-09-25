import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiLink } from "@taiga-ui/core";
import { NavigationService } from "@ui/navigation";
import { Menu } from "../../navigation";



@Component({
  selector: 'footer',
  templateUrl: "footer.component.html",
  styleUrl: 'footer.component.scss',
  standalone: true,
  imports: [
    TuiLink,
    RouterLink
  ]
})
export class FooterPartialComponent {
  private readonly _navigationService = inject(NavigationService);

  public readonly navFirst = this._navigationService.getNavigationFor(Menu.FooterFirst);
  public readonly navSecond = this._navigationService.getNavigationFor(Menu.FooterSecond);
  public readonly navThird = this._navigationService.getNavigationFor(Menu.FooterSecond);
  public readonly navFourth = this._navigationService.getNavigationFor(Menu.FooterFourth);
}