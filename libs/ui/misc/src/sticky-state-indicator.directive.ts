import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: '[stickyStateIndicator]',
  standalone: true,
})
export class StickyStateIndicatorDirective {
  constructor(public elementRef: ElementRef) {}
}
