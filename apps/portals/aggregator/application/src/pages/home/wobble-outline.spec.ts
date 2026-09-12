import { createWobbleOutline } from '../../../../../../../libs/ui/layout/src/decoration/wobble-outline';

describe('canvas feed backing', () => {
  let host: HTMLElement;
  let top: number, width: number, height: number;
  let resize: () => void, themeChange: () => void, motionChange: () => void;
  let reduced: boolean, hidden: boolean;
  let frames: Map<number, FrameRequestCallback>;
  let cleanup: (() => void) | undefined;
  let paint: ReturnType<typeof makeContext>;
  const disconnect = jest.fn();
  const originals = new Map<string, PropertyDescriptor | undefined>();

  function makeContext() {
    return {
      setTransform: jest.fn(), clearRect: jest.fn(), beginPath: jest.fn(),
      moveTo: jest.fn(), lineTo: jest.fn(), bezierCurveTo: jest.fn(), closePath: jest.fn(), stroke: jest.fn(), fill: jest.fn(),
      createLinearGradient: jest.fn((_x0: number, _y0: number, _x1: number, _y1: number) => ({ addColorStop: jest.fn() })),
      fillStyle: '',
    };
  }
  function advance(stamp: number) {
    const scheduled = [...frames.values()];
    frames.clear();
    scheduled.forEach(callback => callback(stamp));
  }
  beforeEach(() => {
    top = 200; width = 848; height = 3000; reduced = hidden = false;
    frames = new Map();
    host = document.createElement('section');
    host.innerHTML = '<button>Feed action</button>';
    host.style.cssText = '--wobble-outline-amplitude: 8; --wobble-outline-duration: 16s; --wobble-outline-color: #667eea; border-radius: 8px;';
    document.body.appendChild(host);
    jest.spyOn(host, 'getBoundingClientRect').mockImplementation(() => ({ top, bottom: top + height, width, height } as DOMRect));
    for (const key of ['ResizeObserver', 'MutationObserver', 'matchMedia', 'devicePixelRatio']) originals.set(key, Object.getOwnPropertyDescriptor(window, key));
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: class {
      constructor(callback: () => void) { resize = callback; }
      observe() {} disconnect = disconnect;
    }});
    Object.defineProperty(window, 'MutationObserver', { configurable: true, value: class {
      constructor(callback: () => void) { themeChange = callback; }
      observe() {} disconnect = disconnect;
    }});
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({
      get matches() { return reduced; },
      addEventListener: (_: string, callback: () => void) => { motionChange = callback; },
      removeEventListener: jest.fn(),
    })});
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    paint = makeContext();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(paint as unknown as CanvasRenderingContext2D);
    let nextFrame = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  });
  afterEach(() => {
    cleanup?.(); cleanup = undefined;
    host.remove();
    jest.restoreAllMocks();
    for (const [key, value] of originals) {
      if (value) Object.defineProperty(window, key, value);
      else Reflect.deleteProperty(window, key);
    }
    originals.clear();
    jest.clearAllMocks();
  });
  function start() { cleanup = createWobbleOutline(host); advance(0); }

  function enableGradient() {
    host.style.setProperty('--wobble-outline-color-2', '#764ba2');
    host.style.setProperty('--wobble-outline-color-3', '#4f46e5');
    host.style.setProperty('--wobble-outline-gradient-duration', '24s');
  }

  it('animates an opaque themed gradient in a continuous loop', () => {
    enableGradient();
    start();
    const initial = paint.createLinearGradient.mock.calls[0];
    const gradient = paint.createLinearGradient.mock.results[0].value;
    expect(paint.fillStyle).toBe(gradient);
    expect(gradient.addColorStop.mock.calls).toEqual([[0, '#667eea'], [0.5, '#764ba2'], [1, '#4f46e5']]);
    advance(6000);
    expect(paint.createLinearGradient.mock.calls[1]).not.toEqual(initial);
    advance(24_000);
    expect(paint.createLinearGradient.mock.calls[2]).toEqual(initial);
    advance(23_999);
    const before = paint.createLinearGradient.mock.calls[3];
    advance(24_001);
    expect(paint.createLinearGradient.mock.calls[4].every((n, i) => Math.abs(n - before[i]) < 0.25)).toBe(true);
    host.style.setProperty('--wobble-outline-color-2', '#4f46e5');
    themeChange(); advance(25_000);
    expect(paint.createLinearGradient.mock.results.at(-1)!.value.addColorStop).toHaveBeenCalledWith(0.5, '#4f46e5');
  });

  it('keeps the gradient static and attached to the feed when scrolling with reduced motion', () => {
    reduced = true;
    enableGradient();
    start();
    const initial = paint.createLinearGradient.mock.calls[0];
    top = -2000;
    window.dispatchEvent(new Event('scroll')); advance(6000);
    expect(paint.createLinearGradient.mock.calls[1]).toEqual(initial);
    expect(frames.size).toBe(0);
  });

  it('fills one closed shape while leaving the feed content still', () => {
    const action = host.querySelector('button');
    start();
    const canvas = host.querySelector('canvas')!;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('svg')).toBeNull();
    expect(paint.fillStyle).toBe('#667eea');
    expect(paint.moveTo).toHaveBeenCalledTimes(1);
    expect(paint.closePath).toHaveBeenCalledTimes(1);
    expect(paint.fill).toHaveBeenCalledTimes(1);
    expect(paint.stroke).not.toHaveBeenCalled();
    expect(host.classList.contains('ui-wobble-ready')).toBe(true);
    const initial = [...paint.bezierCurveTo.mock.calls];
    paint.bezierCurveTo.mockClear();
    advance(2500);
    expect(paint.bezierCurveTo.mock.calls).not.toEqual(initial);
    expect(host.querySelector('button')).toBe(action);
    expect(host.style.transform).toBe('');
    paint.bezierCurveTo.mockClear();
    advance(16_000);
    expect(paint.bezierCurveTo.mock.calls).toEqual(initial);
  });

  it('moves continuously through the animation loop and keeps deformation bounded', () => {
    start();
    const geometry = (stamp: number) => {
      paint.bezierCurveTo.mockClear();
      advance(stamp);
      return paint.bezierCurveTo.mock.calls.flat();
    };
    const before = geometry(15_999), after = geometry(16_001);
    expect(after.every((value, i) => Math.abs(value - before[i]) < 0.1)).toBe(true);
    // The straight top edge cannot escape its 8px deformation envelope (10px bleed).
    const topEdge = paint.bezierCurveTo.mock.calls.slice(0, Math.ceil((width - 32) / 12));
    expect(topEdge.every(call => call[5] >= 2 && call[5] <= 18)).toBe(true);
  });

  it('joins every side and corner when the whole feed fits in the viewport', () => {
    height = 160;
    start();
    expect(paint.moveTo).toHaveBeenCalledTimes(1);
    expect(paint.lineTo).toHaveBeenCalledTimes(7);
    expect(paint.closePath).toHaveBeenCalledTimes(1);
    expect(paint.fill).toHaveBeenCalledTimes(1);
  });

  it('bounds both pixels and sampled edges for a long feed, including deep scrolling', () => {
    height = 10_000_000; top = -5_000_000;
    start();
    const canvas = host.querySelector('canvas')!;
    expect(canvas.width).toBe((width + 20) * 2);
    expect(canvas.height).toBeLessThanOrEqual((window.innerHeight + 20) * 2);
    expect(paint.moveTo).toHaveBeenCalledTimes(1);
    expect(paint.lineTo).toHaveBeenCalledTimes(1); // Join the two visible sides below the crop.
    expect(paint.moveTo.mock.calls[0][1]).toBeLessThan(0);
    expect(paint.lineTo.mock.calls[0][1]).toBeGreaterThan(window.innerHeight + 20);
    expect(paint.bezierCurveTo.mock.calls.length).toBeLessThan(300);
    expect(paint.bezierCurveTo.mock.calls.flat().every(n => Number.isFinite(n) && Math.abs(n) < 2000)).toBe(true);
    width = 280; height += 500;
    resize(); advance(100);
    expect(canvas.width).toBe((width + 20) * 2);
    host.style.setProperty('--wobble-outline-color', '#764ba2');
    themeChange(); advance(200);
    expect(paint.fillStyle).toBe('#764ba2');
  });

  it('draws static edges for reduced motion and only redraws them for layout changes', () => {
    reduced = true;
    start();
    expect(paint.fill).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    top = -300;
    window.dispatchEvent(new Event('scroll')); advance(1000);
    expect(paint.fill).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
    reduced = false; motionChange(); advance(2000);
    expect(frames.size).toBe(1);
    reduced = true; motionChange(); advance(3000);
    expect(frames.size).toBe(0);
  });

  it('pauses offscreen and in hidden tabs, then resumes with current geometry', () => {
    start();
    top = -height - 20;
    window.dispatchEvent(new Event('scroll')); advance(100);
    expect(host.querySelector('canvas')!.style.display).toBe('none');
    expect(frames.size).toBe(0);
    top = 0;
    window.dispatchEvent(new Event('scroll')); advance(200);
    expect(frames.size).toBe(1);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange')); advance(300);
    expect(frames.size).toBe(1);
  });

  it('batches scrolling into the animation frame and cleans up on navigation', () => {
    const remove = jest.spyOn(window, 'removeEventListener');
    start();
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1);
    cleanup!(); cleanup = undefined;
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.classList.contains('ui-wobble-ready')).toBe(false);
    expect(frames.size).toBe(0);
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(remove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['scroll', 'resize']));
    window.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(0);
  });

  it('leaves the feed usable when canvas is unavailable', () => {
    jest.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    start();
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.classList.contains('ui-wobble-ready')).toBe(false);
    expect(host.querySelector('button')!.textContent).toBe('Feed action');
    expect(frames.size).toBe(0);
  });
});
