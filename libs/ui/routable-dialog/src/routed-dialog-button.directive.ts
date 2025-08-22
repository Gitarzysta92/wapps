import { Directive, HostListener, inject, Input } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
@Directive({
  selector: '[routedDialogButton]',
  standalone: true,
})
export class RoutedDialogButton {
  @Input() routedDialogButton: string | undefined;

  public readonly _activatedRoute = inject(ActivatedRoute);
  public readonly _router = inject(Router);

  @HostListener('click', ['$event'])
  public openLoginDialog(): void {
    this._router.navigate([{
      outlets: { dialog: this.routedDialogButton },
      relativeTo: this._activatedRoute
    }])
  }
}