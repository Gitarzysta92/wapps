import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';

export interface OutOfViewportChange {
  isOutOfViewport: boolean;
  element: Element;
}

@Directive({
  selector: '[outOfViewport]',
  standalone: true,
})
export class OutOfViewportDirective implements OnInit, OnDestroy {
  @Output() outOfViewportChange = new EventEmitter<OutOfViewportChange>();

  private readonly elementRef = inject(ElementRef);
  private scrollListener?: () => void;
  private isCurrentlyOutOfViewport = false;

  ngOnInit(): void {
    this.scrollListener = () => this.checkOutOfViewport();
    window.addEventListener('scroll', this.scrollListener, { passive: true });
    
    // Check initial state
    this.checkOutOfViewport();
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }

  private checkOutOfViewport(): void {
    const element = this.elementRef.nativeElement;
    const rect = element.getBoundingClientRect();
    
    // Check if element is completely out of viewport
    const isOutOfViewport = rect.bottom -30 < 0 || rect.top -30 > window.innerHeight;
    console.log('isOutOfViewport:', isOutOfViewport);
  
    // Only emit if the state has changed
    if (isOutOfViewport !== this.isCurrentlyOutOfViewport) {
      this.isCurrentlyOutOfViewport = isOutOfViewport;
      this.outOfViewportChange.emit({
        isOutOfViewport,
        element
      });
    }
  }
}
