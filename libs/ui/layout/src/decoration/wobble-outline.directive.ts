import { afterNextRender, DestroyRef, Directive, ElementRef, inject, NgZone } from '@angular/core';
import { createWobbleOutline } from './wobble-outline';

/** Decorative backing with animated edges. The portal theme supplies its appearance. */
@Directive({ selector: '[uiWobbleOutline]', standalone: true })
export class WobbleOutlineDirective {
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => {
      this.destroyRef.onDestroy(createWobbleOutline(this.host));
    }));
  }
}
