import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiLink } from "@taiga-ui/core";
import type { NavigationDeclaration } from "@ui/navigation";



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
  // WIP: Aggregator navigation wiring is outdated; keep footer minimal until re-aligned to aggregator-demo.
  public readonly navFirst: NavigationDeclaration[] = [];
  public readonly navSecond: NavigationDeclaration[] = [];
  public readonly navThird: NavigationDeclaration[] = [];
  public readonly navFourth: NavigationDeclaration[] = [];
}