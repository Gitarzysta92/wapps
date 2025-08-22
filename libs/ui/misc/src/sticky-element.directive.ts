import { Directive, ElementRef, Renderer2, OnDestroy, AfterViewInit, inject, input } from '@angular/core';
import { WA_INTERSECTION_ROOT } from '@ng-web-apis/intersection-observer';



@Directive({
  selector: '[stickyElement]',
  standalone: true,
})
export class StickyElementDirective implements OnDestroy, AfterViewInit {
  public rootMargin = input<string>();
  public threshold = input<number[]>([]);


  private _o: IntersectionObserver | undefined;

  private readonly _nativeElement: Element = inject(ElementRef).nativeElement;
  private readonly _renderer: Renderer2 = inject(Renderer2);
  private readonly _root: Element | null =
      inject(WA_INTERSECTION_ROOT, {optional: true})?.nativeElement ?? null;

  
  ngAfterViewInit(): void {
    this._o = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) {
            this._renderer.addClass(this._nativeElement, 'stuck');
          } else {
            this._renderer.removeClass(this._nativeElement, 'stuck');
          }
        })
      },
      {
        root: this._root,
        rootMargin: this.rootMargin(),
        threshold: this.threshold(),
      },
    );
    this._o.observe(this._nativeElement)
  }

  ngOnDestroy(): void {
    this._o?.disconnect();
  }
}