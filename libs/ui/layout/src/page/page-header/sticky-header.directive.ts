import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input, NgZone, Renderer2 } from '@angular/core';

/** Bind [uiStickyHeader] to the content element below the header. */
@Directive({
  selector: 'ui-page-header[uiStickyHeader]',
  standalone: true,
  host: { class: 'ui-sticky-header' },
})
export class StickyHeaderDirective {
  readonly content = input.required<HTMLElement>({ alias: 'uiStickyHeader' });
  private readonly document = inject(DOCUMENT);
  private readonly element = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  constructor() {
    // Browser-only: native sticky positioning, with a viewport-aligned content mask.
    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!view) return;
      this.zone.runOutsideAngular(() => {
        const content = this.content();
        const rootStyle = this.document.documentElement.style;
        const clearanceProperty = '--ui-sticky-header-clearance';
        const previousClearance = rootStyle.getPropertyValue(clearanceProperty);
        const previousPriority = rootStyle.getPropertyPriority(clearanceProperty);
        const updateClearance = () => {
          const style = view.getComputedStyle(this.element);
          const top = style.top && style.top !== 'auto' ? style.top : '0px';
          const fade = style.getPropertyValue('--ui-sticky-header-fade').trim() || '0px';
          const offset = style.getPropertyValue('--ui-sticky-header-fade-offset').trim() || '0px';
          rootStyle.setProperty(clearanceProperty, `calc(${top} + ${this.element.offsetHeight}px + ${fade} - ${offset})`);
          content.style.setProperty('--ui-sticky-header-fade', fade);
          content.style.setProperty('--ui-sticky-header-fade-offset', offset);
        };
        const updateMask = () => {
          const boundary = this.element.getBoundingClientRect().bottom - content.getBoundingClientRect().top;
          content.style.setProperty('--ui-sticky-mask-top', `${boundary}px`);
        };
        let frame: number | undefined;
        const scheduleMask = () => {
          if (frame !== undefined) return;
          frame = view.requestAnimationFrame(() => { frame = undefined; updateMask(); });
        };
        const refresh = () => {
          updateClearance();
          updateMask();
        };
        refresh();
        this.renderer.addClass(content, 'ui-sticky-content-masked');
        const observer = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(refresh) : null;
        observer?.observe(this.element);
        observer?.observe(content);
        view.addEventListener('resize', refresh);
        view.addEventListener('scroll', scheduleMask, { passive: true });
        this.destroyRef.onDestroy(() => {
          view.removeEventListener('scroll', scheduleMask);
          view.removeEventListener('resize', refresh);
          if (frame !== undefined) view.cancelAnimationFrame(frame);
          observer?.disconnect();
          this.renderer.removeClass(content, 'ui-sticky-content-masked');
          content.style.removeProperty('--ui-sticky-mask-top');
          content.style.removeProperty('--ui-sticky-header-fade');
          content.style.removeProperty('--ui-sticky-header-fade-offset');
          if (previousClearance) rootStyle.setProperty(clearanceProperty, previousClearance, previousPriority);
          else rootStyle.removeProperty(clearanceProperty);
        });
      });
    });
  }
}
