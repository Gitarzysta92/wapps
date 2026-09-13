import { Directive, ElementRef, HostListener, inject, OnDestroy } from '@angular/core';

/** Enable with --ui-scroll-on-focus-enabled: 1 at the desired breakpoint.
 * Use scroll-margin-top on the host to set the viewport clearance.
 */
@Directive({ selector: '[uiScrollOnFocus]', standalone: true })
export class ScrollOnFocusDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private frame: number | undefined;

  @HostListener('focusin', ['$event'])
  onFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.matches('input, textarea, [contenteditable="true"]') ||
        this.host.contains(event.relatedTarget as Node | null)) return;

    const view = this.host.ownerDocument.defaultView;
    if (!view || view.getComputedStyle(this.host).getPropertyValue('--ui-scroll-on-focus-enabled').trim() !== '1') return;

    this.cancel();
    this.frame = view.requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.host.contains(this.host.ownerDocument.activeElement)) return;
      const clearance = parseFloat(view.getComputedStyle(this.host).scrollMarginTop) || 0;
      const distance = this.host.getBoundingClientRect().top - (view.visualViewport?.offsetTop ?? 0) - clearance;
      if (distance <= 1) return;
      view.scrollTo({
        top: view.scrollY + distance,
        left: view.scrollX,
        behavior: view.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  }

  @HostListener('focusout', ['$event'])
  onBlur(event: FocusEvent): void {
    if (!this.host.contains(event.relatedTarget as Node | null)) this.cancel();
  }

  ngOnDestroy(): void {
    this.cancel();
  }

  private cancel(): void {
    if (this.frame !== undefined) this.host.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
}
