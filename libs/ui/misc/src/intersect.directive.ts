import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

@Directive({
  selector: '[appIntersect]'
})
export class IntersectDirective implements OnInit, OnDestroy {
  @Output() appIntersect = new EventEmitter<{ isVisible: boolean; element: Element }>();
  @Input() threshold?: number | number[] = 0.5;
  @Input() rootMargin?: string = '-20% 0px -20% 0px';
  private observer?: IntersectionObserver;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.observer = new IntersectionObserver(([entry]) => {
      this.appIntersect.emit({ isVisible: entry.isIntersecting, element: this.el.nativeElement });
    }, {
      threshold: this.threshold,
      rootMargin: this.rootMargin,
    });

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
