import { Component, inject, OnDestroy } from "@angular/core";
import { ActivatedRoute, Router, RouterOutlet } from "@angular/router";


@Component({
  template: `<router-outlet></router-outlet>`,
  standalone: true,
  imports: [
    RouterOutlet,
  ]
})
export class RoutableDialogComponent implements OnDestroy {
  
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);

  // TODO: Taiga temporary fix or not closing
  // routed dialog after closing it of different
  // auxiliary route
  ngOnDestroy(): void {
    this._router.navigate([{
      outlets: { dialog: null },
      relativeTo: this._activatedRoute
    }])
  }
}