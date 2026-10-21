import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, EventEmitter, Inject, OnDestroy, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[outsideClick]',
  standalone: true
})
export class  OutsideClickDirective implements AfterViewInit, OnDestroy {

  private _detachMouseclick: (() => void) | undefined;

  @Output() outsideClick: EventEmitter<MouseEvent> = new EventEmitter();

  constructor(
    private readonly _elementRef: ElementRef,
    //private readonly _zone: NgZone,
    private readonly _renderer: Renderer2,
    @Inject(DOCUMENT) private _document: Document
  ) { }


  ngAfterViewInit(): void {
    this._attachListeners();
  }

  ngOnDestroy(): void {
    this._detachListeners();
  }

  private emitEvent(event: MouseEvent) {
    if (this._checkIsInside(event)) return;

    event = new MouseEvent('outsideclick', event)

    this.outsideClick.next(event);
  }

  private _attachListeners(): void {
    this._detachMouseclick = this._renderer.listen(this._document, 'click', event => this.emitEvent(event));
  }

  private _detachListeners(): void {
    this._detachMouseclick?.();
  }

  private _checkIsInside(event: MouseEvent): boolean {
    return event.composedPath()?.some(e => e == this._elementRef.nativeElement);
  }

}
