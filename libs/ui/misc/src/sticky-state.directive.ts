import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';

export interface StickyStateChange {
  isSticky: boolean;
  distanceFromTop: number;
}

@Directive({
  selector: '[stickyState]',
  standalone: true,
})
export class StickyStateDirective implements OnInit, OnDestroy {

  @Input() threshold = 0;

  @Output() stickyStateChange = new EventEmitter<StickyStateChange>();

  private readonly elementRef = inject(ElementRef);
  private scrollListener?: () => void;
  private isCurrentlySticky = false;

  ngOnInit(): void {
    this.scrollListener = () => this.checkStickyState();
    window.addEventListener('scroll', this.scrollListener, { passive: true });
    
    // Check initial state
    this.checkStickyState();
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }

  private checkStickyState(): void {
    const element = this.elementRef.nativeElement;
    const rect = element.getBoundingClientRect();
    const distanceFromTop = rect.bottom;
    
    console.log('distanceFromTop', distanceFromTop);

    // Consider sticky when element is at or above the top of the viewport
    const isSticky = distanceFromTop <= this.threshold;
    
    // Only emit if the state has changed
    if (isSticky !== this.isCurrentlySticky) {
      this.isCurrentlySticky = isSticky;
      this.stickyStateChange.emit({
        isSticky,
        distanceFromTop
      });
    }
  }
}
