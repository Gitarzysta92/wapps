import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageHeaderComponent, StickyHeaderDirective } from '@ui/layout';

@Component({
  standalone: true,
  imports: [PageHeaderComponent, StickyHeaderDirective],
  template: `<ui-page-header [uiStickyHeader]="pageContent"><h1 slot="title">Sticky title</h1></ui-page-header>
    <div #pageContent id="page-content"><a href="#">Scrolling content</a></div>
    <ui-page-header><h2 slot="title">Ordinary title</h2></ui-page-header>`,
})
class TestPage {}

describe('sticky page header', () => {
  let scrollY: number;
  let animationFrame: FrameRequestCallback | undefined;
  const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');

  beforeEach(() => {
    scrollY = 0;
    animationFrame = undefined;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { animationFrame = callback; return 1; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { animationFrame = undefined; });
  });
  afterEach(() => {
    if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    else Reflect.deleteProperty(window, 'scrollY');
    jest.restoreAllMocks();
  });

  async function page() {
    const fixture = TestBed.createComponent(TestPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function scrollTo(y: number) {
    scrollY = y;
    window.dispatchEvent(new Event('scroll'));
    const callback = animationFrame;
    animationFrame = undefined;
    callback?.(0);
  }

  it('masks only the scrolling content and clears the mask at the top', async () => {
    const fixture = await page();
    const [sticky, ordinary] = fixture.nativeElement.querySelectorAll('ui-page-header');
    const content = fixture.nativeElement.querySelector('#page-content');
    expect(sticky.classList.contains('ui-sticky-header')).toBe(true);
    expect(content.classList.contains('ui-sticky-content-masked')).toBe(false);
    scrollTo(300);
    expect(content.classList.contains('ui-sticky-content-masked')).toBe(true);
    expect(sticky.classList.contains('ui-sticky-content-masked')).toBe(false);
    expect(ordinary.classList.contains('ui-sticky-header')).toBe(false);
    scrollTo(0);
    expect(content.classList.contains('ui-sticky-content-masked')).toBe(false);
  });

  it('initializes correctly when navigation restores a scrolled position', async () => {
    scrollY = 600;
    const fixture = await page();
    expect(fixture.nativeElement.querySelector('#page-content').classList.contains('ui-sticky-content-masked')).toBe(true);
  });

  it('keeps the mask aligned with the header as content scrolls and the header resizes', async () => {
    const fixture = await page();
    const header = fixture.nativeElement.querySelector('.ui-sticky-header');
    const content = fixture.nativeElement.querySelector('#page-content');
    let headerBottom = 180;
    jest.spyOn(header, 'getBoundingClientRect').mockImplementation(() => ({ bottom: headerBottom }));
    jest.spyOn(content, 'getBoundingClientRect').mockImplementation(() => ({ top: 200 - scrollY }));
    scrollTo(500);
    expect(content.style.getPropertyValue('--ui-sticky-mask-top')).toBe('480px');
    headerBottom = 220;
    window.dispatchEvent(new Event('resize'));
    expect(content.style.getPropertyValue('--ui-sticky-mask-top')).toBe('520px');
  });

  it('batches scroll events and cancels pending work on navigation', async () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const fixture = await page();
    const listener = add.mock.calls.find(([type]) => type === 'scroll');
    expect(listener?.[2]).toEqual({ passive: true });
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('scroll'));
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(remove).toHaveBeenCalledWith('scroll', listener?.[1]);
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('reserves focus clearance for the rendered header and restores it on navigation', async () => {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--ui-sticky-header-clearance', '12px');
    const fixture = await page();
    const header = fixture.nativeElement.querySelector('.ui-sticky-header');
    Object.defineProperty(header, 'offsetHeight', { value: 120 });
    header.style.top = '80px';
    header.style.setProperty('--ui-sticky-header-fade', '48px');
    window.dispatchEvent(new Event('resize'));
    expect(rootStyle.getPropertyValue('--ui-sticky-header-clearance')).toBe('calc(80px + 120px + 48px)');
    fixture.destroy();
    expect(rootStyle.getPropertyValue('--ui-sticky-header-clearance')).toBe('12px');
    rootStyle.removeProperty('--ui-sticky-header-clearance');
  });
});
