import { afterNextRender, booleanAttribute, DestroyRef, Directive, ElementRef, inject, input, NgZone } from '@angular/core';
import { createDecorationFade } from './decoration-fade';

/** Fades direct canvas decorations with page scroll, keeping content fully opaque. */
@Directive({
  selector: '[uiDecorationFade]',
  standalone: true,
  host: { '[class.ui-decoration-faded]': 'enabled()' },
})
export class DecorationFadeDirective {
  readonly enabled = input(true, { alias: 'uiDecorationFade', transform: booleanAttribute });
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => {
      this.destroyRef.onDestroy(createDecorationFade(this.host));
    }));
  }
}
