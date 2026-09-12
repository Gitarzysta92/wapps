import { createDecorationFade } from '../../../../../../../libs/ui/layout/src/decoration/decoration-fade';

describe('scroll-driven decoration fade', () => {
  let host: HTMLElement;
  let scroll: number;
  let cleanup: () => void;
  let frames: Map<number, FrameRequestCallback>;
  const originalScroll = Object.getOwnPropertyDescriptor(window, 'scrollY')!;

  beforeEach(() => {
    host = document.createElement('section');
    host.style.setProperty('--decoration-fade-distance', '400');
    document.body.appendChild(host);
    scroll = 0;
    frames = new Map();
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scroll });
    let next = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++next, callback); return next; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  });
  afterEach(() => {
    cleanup?.();
    host.remove();
    jest.restoreAllMocks();
    Object.defineProperty(window, 'scrollY', originalScroll);
  });
  const progress = () => Number(host.style.getPropertyValue('--decoration-fade-progress'));
  function flush() {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(0));
  }
  function scrollTo(y: number) {
    scroll = y;
    window.dispatchEvent(new Event('scroll'));
    flush();
  }

  it('fades gradually, stops at its limit and restores on scrolling up', () => {
    cleanup = createDecorationFade(host);
    expect(progress()).toBe(0);
    scrollTo(100);
    expect(progress()).toBeGreaterThan(0);
    expect(progress()).toBeLessThan(0.5);
    scrollTo(200);
    expect(progress()).toBe(0.5);
    scrollTo(400);
    expect(progress()).toBe(1);
    scrollTo(4000);
    expect(progress()).toBe(1);
    scrollTo(200);
    expect(progress()).toBe(0.5);
    scrollTo(-20); // Safari overscroll must not brighten beyond full strength.
    expect(progress()).toBe(0);
    expect(host.style.opacity).toBe('');
    expect(frames.size).toBe(0);
  });

  it('initializes at the restored page position and reads the theme distance', () => {
    scroll = 400;
    cleanup = createDecorationFade(host);
    expect(progress()).toBe(1);
    host.style.setProperty('--decoration-fade-distance', '800');
    window.dispatchEvent(new Event('resize'));
    flush();
    expect(progress()).toBe(0.5);
  });

  it('leaves native scroll animations to the browser without JS scroll work', () => {
    host.style.setProperty('--decoration-native-scroll', '1');
    const listen = jest.spyOn(window, 'addEventListener');
    cleanup = createDecorationFade(host);
    scrollTo(200);
    expect(listen).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(host.style.getPropertyValue('--decoration-fade-progress')).toBe('');
  });

  it('does not force computed-style reads during fallback scrolling', () => {
    cleanup = createDecorationFade(host);
    const readStyle = jest.spyOn(window, 'getComputedStyle');
    scrollTo(100); scrollTo(200); scrollTo(300);
    expect(readStyle).not.toHaveBeenCalled();
    expect(progress()).toBeCloseTo(0.84375);
  });

  it('batches scroll events, avoids redundant style writes and cleans up', () => {
    scroll = 800;
    cleanup = createDecorationFade(host);
    const setProperty = jest.spyOn(host.style, 'setProperty');
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1);
    flush();
    expect(setProperty).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('scroll'));
    cleanup();
    expect(frames.size).toBe(0);
    expect(host.style.getPropertyValue('--decoration-fade-progress')).toBe('');
    window.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(0);
  });
});
