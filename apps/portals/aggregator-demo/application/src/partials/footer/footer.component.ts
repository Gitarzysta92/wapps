import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiLink } from "@taiga-ui/core";
import { NavigationDeclarationDto } from "@portals/shared/boundary/navigation";


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
  @Input('primaryNavigation') navFirst: NavigationDeclarationDto[] = []
  @Input('secondaryNavigation') navSecond: NavigationDeclarationDto[] = []
  @Input('tertiaryNavigation') navThird: NavigationDeclarationDto[] = []
  @Input('quaternaryNavigation') navFourth: NavigationDeclarationDto[] = []
}