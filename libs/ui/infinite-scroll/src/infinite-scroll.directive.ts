import { Directive, EventEmitter, inject, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { debounceTime, fromEvent, Subscription } from 'rxjs';
import { WA_WINDOW } from '@ng-web-apis/common';

@Directive({
  selector: '[appInfiniteScroll]'
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {

  @Input() bottomOffset = 300;
  @Output() scrolledToBottom = new EventEmitter<void>();

  private readonly _scrollContainer = inject(WA_WINDOW, { optional: true });
  private readonly _zone = inject(NgZone);
  private s: Subscription | undefined;

  ngOnInit(): void {
    if (this._scrollContainer !== null) {
      this._zone.runOutsideAngular(() => {
        this.s = fromEvent(this._scrollContainer!, 'scroll')
          .pipe(debounceTime(200))
          .subscribe(() => {
            const scrollTop = this._scrollContainer!.scrollY;
            const clientHeight = window.innerHeight;
            const scrollHeight = document.documentElement.scrollHeight;

            if (scrollTop + clientHeight + this.bottomOffset >= scrollHeight) {
              this.scrolledToBottom.emit();
            }
          });
      })
    }
  }
  
  ngOnDestroy(): void {
    this.s?.unsubscribe();
  }

}