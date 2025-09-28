import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, inject, ViewChildren, ContentChildren, QueryList, AfterViewInit, AfterContentInit } from '@angular/core';
import { StickyStateIndicatorDirective } from './sticky-state-indicator.directive';

export interface StickyStateChange {
  isSticky: boolean;
  distanceFromTop: number;
}

@Directive({
  selector: '[stickyState]',
  standalone: true,
})
export class StickyStateDirective implements OnInit, OnDestroy, AfterViewInit, AfterContentInit {

  @Input() threshold = 0;

  @Output() stickyStateChange = new EventEmitter<StickyStateChange>();

  @ViewChildren(StickyStateIndicatorDirective) viewIndicatorDirectives!: QueryList<StickyStateIndicatorDirective>;
  @ContentChildren(StickyStateIndicatorDirective) contentIndicatorDirectives!: QueryList<StickyStateIndicatorDirective>;

  private readonly elementRef = inject(ElementRef);
  private scrollListener?: () => void;
  private isCurrentlySticky = false;
  private indicatorElement?: Element;

  ngOnInit(): void {
    this.scrollListener = () => this.checkStickyState();
    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  ngAfterViewInit(): void {
    console.log('viewIndicatorDirectives:', this.viewIndicatorDirectives);
    console.log('viewIndicatorDirectives length:', this.viewIndicatorDirectives?.length);
    this.findIndicatorElement();
  }

  ngAfterContentInit(): void {
    console.log('contentIndicatorDirectives:', this.contentIndicatorDirectives);
    console.log('contentIndicatorDirectives length:', this.contentIndicatorDirectives?.length);
    this.findIndicatorElement();
  }

  private findIndicatorElement(): void {
    let indicatorDirectives = this.viewIndicatorDirectives || this.contentIndicatorDirectives;
    
    if (indicatorDirectives && indicatorDirectives.length > 0) {
      this.indicatorElement = indicatorDirectives.first.elementRef.nativeElement;
      console.log('Found indicator element:', this.indicatorElement);
      this.checkStickyState();
    } else {
      console.warn('No sticky state indicator found, falling back to host element');
      this.indicatorElement = this.elementRef.nativeElement;
      this.checkStickyState();
    }
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }

  private checkStickyState(): void {
    if (!this.indicatorElement) {
      return;
    }

    const rect = this.indicatorElement.getBoundingClientRect();
    const distanceFromTop = rect.top;
    
    console.log('indicator distanceFromTop', this.indicatorElement, distanceFromTop);

    // Consider sticky when indicator element is at or above the top of the viewport
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
