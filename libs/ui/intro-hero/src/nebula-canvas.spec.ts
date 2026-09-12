import { createNebulaCanvas, getNebulaClouds } from './nebula-canvas';

describe('infinite nebula coordinates', () => {
  it.each([0, 10_000, 1_000_000, 1_000_000_000])('keeps linear parallax at scroll %i', scroll => {
    const before = getNebulaClouds(1440, 1000, scroll);
    const after = getNebulaClouds(1440, 1000, scroll + 100);
    const common = before.filter(a => after.some(b => a.layer === b.layer && a.cell === b.cell));
    expect(common.length).toBeGreaterThan(0);
    for (const cloud of common) {
      const moved = after.find(b => cloud.layer === b.layer && cloud.cell === b.cell)!;
      expect(cloud.y - moved.y).toBeCloseTo([14, 28, 44][cloud.layer], 5);
      expect([moved.x, moved.size, moved.angle]).toEqual([cloud.x, cloud.size, cloud.angle]);
    }
  });

  it('samples a bounded number of clouds, regardless of scroll history or depth', () => {
    for (const width of [320, 768, 2422]) {
      const original = getNebulaClouds(width, 1000, 500);
      for (const scroll of [0, 12_345, 1_000_000, 1_000_000_000]) {
        const clouds = getNebulaClouds(width, 1000, scroll);
        expect(clouds.length).toBeGreaterThan(0);
        expect(clouds.length).toBeLessThanOrEqual(9);
        expect(clouds.every(cloud => Number.isFinite(cloud.y) && Math.abs(cloud.y) < 3000)).toBe(true);
      }
      expect(getNebulaClouds(width, 1000, 500)).toEqual(original);
    }
  });

  it('introduces new cells beyond the viewport without relocating visible clouds', () => {
    let previous = getNebulaClouds(1440, 1000, 0);
    let entries = 0;
    for (let scroll = 10; scroll <= 20_000; scroll += 10) {
      const next = getNebulaClouds(1440, 1000, scroll);
      for (const cloud of next) {
        const old = previous.find(p => p.layer === cloud.layer && p.cell === cloud.cell);
        if (old) expect(old.y - cloud.y).toBeCloseTo([1.4, 2.8, 4.4][cloud.layer]);
        else {
          entries++;
          expect(cloud.y - cloud.size * 0.72).toBeGreaterThan(995);
        }
      }
      previous = next;
    }
    expect(entries).toBeGreaterThan(3);
  });
});

describe('nebula canvas', () => {
  let host: HTMLElement;
  let canvas: HTMLCanvasElement;
  let context: ReturnType<typeof makeContext>;
  let contexts: ReturnType<typeof makeContext>[];
  let motion: MediaQueryList;
  let reduced: boolean;
  let hidden: boolean;
  let motionChange: () => void;
  let themeChange: (records?: MutationRecord[]) => void;
  let resize: () => void;
  let disconnectResize: jest.Mock;
  let disconnectTheme: jest.Mock;
  let frames: Map<number, FrameRequestCallback>;
  let cleanup: (() => void) | undefined;
  const originals = Object.getOwnPropertyDescriptors(window);

  function makeContext() {
    return {
      createImageData: jest.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })),
      putImageData: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(),
      setTransform: jest.fn(), clearRect: jest.fn(), save: jest.fn(), restore: jest.fn(),
      translate: jest.fn(), rotate: jest.fn(), beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(),
      globalAlpha: 1, fillStyle: '', globalCompositeOperation: '',
    };
  }
  function advance(stamp: number) {
    const scheduled = [...frames.values()];
    frames.clear();
    scheduled.forEach(callback => callback(stamp));
  }
  function scrollTo(y: number) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    window.dispatchEvent(new Event('scroll'));
  }
  beforeEach(() => {
    contexts = [];
    reduced = hidden = false;
    frames = new Map();
    let nextFrame = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    motion = {
      get matches() { return reduced; },
      addEventListener: jest.fn((_, callback) => { motionChange = callback as () => void; }),
      removeEventListener: jest.fn(),
    } as unknown as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(() => motion) });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    disconnectResize = jest.fn();
    disconnectTheme = jest.fn();
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: jest.fn(callback => {
      resize = callback;
      return { observe: jest.fn(), disconnect: disconnectResize };
    }) });
    Object.defineProperty(window, 'MutationObserver', { configurable: true, value: jest.fn(callback => {
      themeChange = callback;
      return { observe: jest.fn(), disconnect: disconnectTheme };
    }) });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      const result = makeContext();
      contexts.push(result);
      return result as unknown as CanvasRenderingContext2D;
    });
    host = document.createElement('div');
    canvas = document.createElement('canvas');
    host.append(canvas);
    document.body.append(host);
    host.style.cssText = '--nebula-color-1: #764ba2; --nebula-color-2: #667eea; --nebula-color-3: #10b981; --nebula-opacity: 0.4;';
    jest.spyOn(host, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 600 } as DOMRect);
  });
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    host.remove();
    jest.restoreAllMocks();
    for (const name of ['matchMedia', 'devicePixelRatio', 'ResizeObserver', 'MutationObserver', 'scrollY']) {
      if (originals[name]) Object.defineProperty(window, name, originals[name]);
      else Reflect.deleteProperty(window, name);
    }
  });
  function start() {
    cleanup = createNebulaCanvas(canvas, host);
    context = contexts[0];
  }

  it('uses transparent textured clouds and caps the canvas resolution', () => {
    start();
    expect([canvas.width, canvas.height]).toEqual([1200, 900]);
    const alpha = contexts[1].putImageData.mock.calls[0][0].data.filter((_: number, i: number) => i % 4 === 3);
    expect(alpha[0]).toBe(0);
    expect(new Set(alpha).size).toBeGreaterThan(100);
    const textures = contexts.slice(4);
    expect(textures.map(paint => paint.fillStyle)).toEqual(['#764ba2', '#667eea', '#10b981']);
    expect(context.globalAlpha).toBe(0.4);
  });

  it('redraws on resize and theme changes without rebuilding cloud noise', () => {
    start();
    const maskCalls = contexts.slice(1, 4).map(paint => paint.putImageData.mock.calls.length);
    host.style.setProperty('--nebula-color-1', '#abcdef');
    host.style.setProperty('--nebula-opacity', '0.2');
    themeChange();
    advance(100);
    expect(contexts[7].fillStyle).toBe('#abcdef');
    expect(context.globalAlpha).toBe(0.2);
    jest.mocked(host.getBoundingClientRect).mockReturnValue({ width: 390, height: 844 } as DOMRect);
    resize();
    expect([canvas.width, canvas.height]).toEqual([585, 1266]);
    expect(contexts.slice(1, 4).map(paint => paint.putImageData.mock.calls.length)).toEqual(maskCalls);
  });

  it('ignores fallback fade progress while observing actual theme changes', () => {
    start();
    const oldValue = host.getAttribute('style');
    const readStyle = jest.spyOn(window, 'getComputedStyle');
    host.style.setProperty('--decoration-fade-progress', '0.5');
    const record = { target: host, attributeName: 'style', oldValue } as MutationRecord;
    themeChange([record]);
    expect(readStyle).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    host.style.setProperty('--nebula-opacity', '0.2');
    themeChange([record]); advance(16);
    expect(readStyle).toHaveBeenCalledTimes(1);
    expect(context.globalAlpha).toBe(0.2);
  });

  it('keeps a static background with reduced motion and responds when the preference changes', () => {
    reduced = true;
    start();
    expect(context.drawImage).toHaveBeenCalled();
    expect(frames.size).toBe(0);
    const stationary = [...context.translate.mock.calls];
    scrollTo(500);
    expect(frames.size).toBe(0);
    reduced = false;
    motionChange();
    expect(frames.size).toBe(1);
    context.translate.mockClear();
    advance(100);
    expect(context.translate.mock.calls).not.toEqual(stationary);
    reduced = true;
    motionChange();
    context.translate.mockClear();
    advance(200);
    expect(frames.size).toBe(0);
    expect(context.translate.mock.calls).toEqual(stationary);
  });

  it('does no idle or pointer animation, and batches scrolling into one deterministic frame', () => {
    start();
    const drawCount = context.clearRect.mock.calls.length;
    expect(frames.size).toBe(0);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 800, clientY: 600 }));
    advance(100);
    expect(context.clearRect).toHaveBeenCalledTimes(drawCount);
    scrollTo(100);
    scrollTo(200);
    scrollTo(500);
    expect(frames.size).toBe(1);
    context.translate.mockClear();
    advance(200);
    const at500 = [...context.translate.mock.calls];
    expect(frames.size).toBe(0);
    expect(context.clearRect).toHaveBeenCalledTimes(drawCount + 1);
    scrollTo(1_000_000);
    advance(300);
    scrollTo(500);
    context.translate.mockClear();
    advance(400);
    expect(context.translate.mock.calls).toEqual(at500);
  });

  it('pauses hidden tabs and removes the frame, observers and listeners on teardown', () => {
    const remove = jest.spyOn(window, 'removeEventListener');
    start();
    scrollTo(200);
    expect(frames.size).toBe(1);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    scrollTo(500);
    expect(frames.size).toBe(0);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(1);
    cleanup!();
    cleanup = undefined;
    expect(frames.size).toBe(0);
    expect(disconnectResize).toHaveBeenCalledTimes(1);
    expect(disconnectTheme).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(motion.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('keeps the page usable if a 2D canvas context is unavailable', () => {
    jest.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    cleanup = createNebulaCanvas(canvas, host);
    expect(frames.size).toBe(0);
    expect(() => cleanup!()).not.toThrow();
  });
});
