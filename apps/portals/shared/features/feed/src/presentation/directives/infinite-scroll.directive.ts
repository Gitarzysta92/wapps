import { Directive, ElementRef, EventEmitter, HostListener, Input, Output, OnDestroy, OnInit } from '@angular/core';
import { debounceTime, Subject, takeUntil } from 'rxjs';

@Directive({
  selector: '[infiniteScroll]',
  standalone: true
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  @Input() threshold = 100; // Distance from bottom to trigger load
  @Input() disabled = false;
  @Output() scrolled = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private scrollSubject$ = new Subject<void>();

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.scrollSubject$
      .pipe(
        debounceTime(100), // Debounce scroll events
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.checkScroll();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('scroll', ['$event'])
  onScroll(): void {
    if (!this.disabled) {
      this.scrollSubject$.next();
    }
  }

  private checkScroll(): void {
    const element = this.elementRef.nativeElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    // Check if user has scrolled near the bottom
    if (scrollTop + clientHeight >= scrollHeight - this.threshold) {
      this.scrolled.emit();
    }
  }
}
