import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScrollOnFocusDirective } from '@ui/misc';

@Component({
  imports: [ScrollOnFocusDirective],
  template: `<section uiScrollOnFocus style="--ui-scroll-on-focus-enabled: 1; scroll-margin-top: 16px">
    <input /><button>Search</button><a href="#result">Result</a>
  </section><button id="outside">Outside</button>`,
})
class SearchHost {}

describe('Scroll on focus', () => {
  let frames: Map<number, FrameRequestCallback>;
  let reducedMotion = false;
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  beforeEach(() => {
    frames = new Map();
    let id = 0;
    reducedMotion = false;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++id, callback);
      return id;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(() => ({ matches: reducedMotion })) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    else Reflect.deleteProperty(window, 'matchMedia');
  });

  function setup(top = 200) {
    const fixture = TestBed.createComponent(SearchHost);
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('section') as HTMLElement;
    jest.spyOn(section, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
    const input = section.querySelector('input')!;
    return { fixture, section, input };
  }

  function renderFrame() {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(0));
  }

  it('scrolls once on entry, without reacting to typing or focus moving within the search', () => {
    const { input, section } = setup();
    input.focus();
    renderFrame();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 184, left: 0, behavior: 'smooth' });
    input.value = 'photo';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    section.querySelector('a')!.focus();
    input.focus();
    renderFrame();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('does not scroll in the desktop layout', () => {
    const { input, section } = setup();
    section.style.removeProperty('--ui-scroll-on-focus-enabled');
    input.focus();
    renderFrame();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it.each([16, 0])('does not move a search already near the top (%ipx)', top => {
    const { input } = setup(top);
    input.focus();
    renderFrame();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('respects reduced motion', () => {
    reducedMotion = true;
    const { input } = setup();
    input.focus();
    renderFrame();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 184, left: 0, behavior: 'auto' });
  });

  it('cancels pending scrolling when focus leaves and does not restore the old position', () => {
    const { input, fixture } = setup();
    input.focus();
    fixture.nativeElement.querySelector('#outside').focus();
    renderFrame();
    expect(window.scrollTo).not.toHaveBeenCalled();
    input.focus();
    renderFrame();
    fixture.nativeElement.querySelector('#outside').focus();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('ignores button focus and cancels a pending frame on destruction', () => {
    const { input, section, fixture } = setup();
    section.querySelector('button')!.focus();
    renderFrame();
    expect(window.scrollTo).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('#outside').focus();
    input.focus();
    fixture.destroy();
    expect(frames.size).toBe(0);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
