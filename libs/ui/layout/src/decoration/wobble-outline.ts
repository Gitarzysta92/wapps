import { BubblePhysics, createLiquidBubbleMotion, liquidBubbleContours, sampleLiquidBubbles } from './liquid-bubbles';

type EdgePoint = { x: number; y: number; nx: number; ny: number };

// Seeded value noise, with quintic interpolation for continuous acceleration.
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = smooth(x - ix), v = smooth(y - iy);
  const hash = (a: number, b: number) => {
    let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295 * 2 - 1;
  };
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Domain-warped fractal noise. Circular time coordinates make a seamless loop. */
function displacement(x: number, y: number, timeX: number, timeY: number): number {
  const u = x / 140 + timeX, v = y / 140 + timeY;
  const warpX = noise(u * 0.6, v * 0.6, 73) * 0.8;
  const warpY = noise(u * 0.6, v * 0.6, 197) * 0.8;
  let value = 0, weight = 1, frequency = 1;
  for (let octave = 0; octave < 3; octave++) {
    value += noise((u + warpX) * frequency, (v + warpY) * frequency, 419 + octave * 131) * weight;
    frequency *= 2;
    weight *= 0.5;
  }
  return value / 1.75;
}

/** Sample only visible edges; work stays bounded as the feed grows. */
function visibleEdges(width: number, height: number, radius: number, start: number, end: number): EdgePoint[][] {
  const edges: EdgePoint[][] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number) => {
    if (Math.max(y1, y2) < start || Math.min(y1, y2) > end) return;
    if (y1 !== y2) {
      y1 = Math.max(start, Math.min(end, y1));
      y2 = Math.max(start, Math.min(end, y2));
    }
    const count = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 12));
    edges.push(Array.from({ length: count + 1 }, (_, i) => ({
      x: x1 + (x2 - x1) * i / count, y: y1 + (y2 - y1) * i / count, nx, ny,
    })));
  };
  const r = Math.min(radius, width / 2, height / 2);
  const corner = (cx: number, cy: number, angle: number) => {
    if (cy + r < start || cy - r > end) return;
    edges.push(Array.from({ length: 9 }, (_, i) => {
      const a = (angle + i / 8) * Math.PI / 2;
      const nx = Math.cos(a), ny = Math.sin(a);
      return { x: cx + nx * r, y: cy + ny * r, nx, ny };
    }));
  };
  // Clockwise segments form one filled silhouette. Missing edges join outside the crop.
  line(r, 0, width - r, 0, 0, -1);
  corner(width - r, r, -1);
  line(width, r, width, height - r, 1, 0);
  corner(width - r, height - r, 0);
  line(width - r, height, r, height, 0, 1);
  corner(r, height - r, 1);
  line(0, height - r, 0, r, -1, 0);
  corner(r, r, 2);
  return edges;
}

/** Opaque animated backing beneath content; appearance comes from the host's theme. */
export function createWobbleOutline(host: HTMLElement): () => void {
  const document = host.ownerDocument;
  const view = document.defaultView;
  const canvas = document.createElement('canvas');
  const paint = canvas.getContext('2d');
  if (!view || !paint) return () => undefined;
  canvas.className = 'ui-wobble-outline';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'none';
  host.appendChild(canvas);

  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  let frame: number | undefined;
  let geometryDirty = true, visible = false, ready = false;
  let amplitude = 0, duration = 16_000, radius = 0, color = '';
  let topAmplitude = 0, topWavelength = 220;
  let gradientDuration = 24_000, gradientColors: string[] = [];
  let bubbleRadius = 0, bubbleRise = 0, bubbleDuration = 9000, hostWidth = 0;
  let bubbleCount = 0;
  let bubblePhysics: BubblePhysics;
  let bubbleMotion = createLiquidBubbleMotion();
  const bubbleSeed = Math.floor(Math.random() * 0x7fffffff);
  let width = 0, height = 0, start = 0, bleed = 0, ratio = 1;
  let edges: EdgePoint[][] = [];

  const updateGeometry = () => {
    const bounds = host.getBoundingClientRect();
    const topBleed = topAmplitude + (motion.matches ? amplitude + 2 : Math.max(amplitude + 2, bubbleRise + bubbleRadius * 2 + amplitude + 2));
    visible = bounds.bottom > 0 && bounds.top - topBleed < view.innerHeight && bounds.width > 0 && bounds.height > 0;
    canvas.style.display = visible ? '' : 'none';
    if (!visible) return;
    bleed = Math.ceil(amplitude + 2);
    start = Math.max(-topBleed, -bounds.top - bleed);
    if (hostWidth !== bounds.width) bubbleMotion = createLiquidBubbleMotion();
    hostWidth = bounds.width;
    width = bounds.width + bleed * 2;
    height = Math.min(bounds.height + bleed, view.innerHeight - bounds.top + bleed) - start;
    ratio = Math.min(view.devicePixelRatio || 1, 2);
    canvas.style.left = `${-bleed}px`;
    canvas.style.top = `${start}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const pixelsWide = Math.ceil(width * ratio), pixelsHigh = Math.ceil(height * ratio);
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    edges = visibleEdges(bounds.width, bounds.height, Math.max(radius, amplitude * 2), start - bleed * 2, start + height + bleed * 2);
  };

  const draw = (stamp: number) => {
    frame = undefined;
    if (document.hidden) return;
    if (geometryDirty) { updateGeometry(); geometryDirty = false; }
    if (!visible) return;
    const phase = motion.matches ? 0 : (stamp % duration) / duration * Math.PI * 2;
    paint.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint.clearRect(0, 0, width, height);
    paint.fillStyle = color;
    if (gradientColors.length) {
      const gradientPhase = motion.matches ? 0 : (stamp % gradientDuration) / gradientDuration * Math.PI * 2;
      const shift = Math.sin(gradientPhase) * width * 0.45;
      // A horizontal field stays attached to the feed even when its canvas crop scrolls.
      const gradient = paint.createLinearGradient(-width * 0.35 + shift, 0, width * 1.35 + shift, 0);
      gradientColors.forEach((stop, i) => gradient.addColorStop(i / (gradientColors.length - 1), stop));
      paint.fillStyle = gradient;
    }
    paint.beginPath();
    const timeX = Math.cos(phase) * 0.9, timeY = Math.sin(phase) * 0.9;
    const topLift = (x: number, at = phase) => {
      const k = x / topWavelength * Math.PI * 2;
      const wave = Math.sin(k + at) * 0.65 + Math.sin(k * 0.55 - at * 2) * 0.35;
      // Broad rolling crests taper smoothly into the unchanged side edges.
      const taper = Math.sin(Math.min(1, Math.max(0, Math.min(x, hostWidth - x)) / 64) * Math.PI / 2) ** 2;
      return topAmplitude * (0.5 + wave * 0.5) * taper;
    };
    const surface = (x: number, at = phase) =>
      -amplitude * displacement(x, 0, Math.cos(at) * 0.9, Math.sin(at) * 0.9) - topLift(x, at);
    let first = true;
    for (const edge of edges) {
      const points = edge.map(({ x, y, nx, ny }) => {
        const wave = amplitude * displacement(x, y, timeX, timeY);
        // Local canvas coordinates retain precision even far down a long feed.
        return { x: x + bleed + nx * wave, y: y - start + ny * wave - (ny < 0 ? topLift(x) * ny * ny : 0) };
      });
      if (first) paint.moveTo(points[0].x, points[0].y);
      else paint.lineTo(points[0].x, points[0].y);
      first = false;
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
        paint.bezierCurveTo(b.x + (c.x - a.x) / 6, b.y + (c.y - a.y) / 6,
          c.x - (d.x - b.x) / 6, c.y - (d.y - b.y) / 6, c.x, c.y);
      }
    }
    paint.closePath();
    paint.fill();
    if (!motion.matches && bubbleRadius > 0 && start < bubbleRadius * 2) {
      // Only small patches along the top edge are sampled, regardless of feed length.
      const candidates = sampleLiquidBubbles(stamp, hostWidth, bubbleRadius, bubbleRise, bubbleDuration, bubbleCount, bubbleSeed);
      bubbleMotion(stamp, candidates, (x, time) => {
        const at = time / duration * Math.PI * 2;
        const step = 0.01 / duration * 1000 * Math.PI * 2;
        return {
          height: topAmplitude > 0 ? topLift(x, at) / topAmplitude : 0,
          base: surface(x, at),
          velocity: (surface(x, at + step) - surface(x, at - step)) / 0.02,
        };
      }, bubblePhysics).forEach(bubble => {
        const paths = liquidBubbleContours(bubble, surface);
        paint.beginPath();
        for (const points of paths) {
          paint.moveTo(points[0].x + bleed, points[0].y - start);
          for (const point of points.slice(1)) paint.lineTo(point.x + bleed, point.y - start);
          paint.closePath();
        }
        paint.fill();
      });
    }
    if (!ready) {
      host.classList.add('ui-wobble-ready');
      ready = true;
    }
    if (!motion.matches) requestDraw();
  };
  const requestDraw = () => {
    if (frame === undefined && !document.hidden) frame = view.requestAnimationFrame(draw);
  };
  const onScroll = () => { geometryDirty = true; requestDraw(); };
  const refresh = () => {
    const style = view.getComputedStyle(host);
    amplitude = Math.max(0, Number(style.getPropertyValue('--wobble-outline-amplitude')) || 0);
    topAmplitude = Math.max(0, parseFloat(style.getPropertyValue('--wobble-top-amplitude')) || 0);
    topWavelength = Math.max(48, parseFloat(style.getPropertyValue('--wobble-top-wavelength')) || 220);
    color = style.getPropertyValue('--wobble-outline-color').trim();
    const accents = [2, 3].map(i => style.getPropertyValue(`--wobble-outline-color-${i}`).trim());
    gradientColors = accents.every(Boolean) ? [color, ...accents] : [];
    const readDuration = (token: string, fallback: number) => {
      const speed = style.getPropertyValue(token).trim();
      return Math.max(1000, (parseFloat(speed) || fallback) * (speed.endsWith('ms') ? 1 : 1000));
    };
    duration = readDuration('--wobble-outline-duration', 16);
    gradientDuration = readDuration('--wobble-outline-gradient-duration', 24);
    bubbleRadius = Math.max(0, parseFloat(style.getPropertyValue('--wobble-bubble-radius')) || 0);
    bubbleRise = Math.max(0, parseFloat(style.getPropertyValue('--wobble-bubble-rise')) || 0);
    bubbleDuration = readDuration('--wobble-bubble-duration', 9);
    bubbleCount = Math.max(0, Math.min(16, Math.floor(parseFloat(style.getPropertyValue('--wobble-bubble-count')) || 0)));
    const readNumber = (token: string, fallback: number) => parseFloat(style.getPropertyValue(token)) || fallback;
    bubblePhysics = {
      buoyancy: Math.max(1, readNumber('--wobble-bubble-buoyancy', 100)),
      tension: Math.max(1, readNumber('--wobble-bubble-tension', 32)),
      damping: Math.max(1, readNumber('--wobble-bubble-damping', 10)),
      releaseHeight: Math.max(0, Math.min(0.99, readNumber('--wobble-bubble-release-height', 0.75))),
      growthStart: Math.max(0, Math.min(0.99, readNumber('--wobble-bubble-growth-start', 0.35))),
    };
    radius = Math.max(0, parseFloat(style.borderTopLeftRadius) || 0);
    onScroll();
  };
  const updateMotion = () => {
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    frame = undefined;
    onScroll();
  };
  const resizeObserver = new view.ResizeObserver(refresh);
  resizeObserver.observe(host);
  const themeObserver = new view.MutationObserver(refresh);
  for (let parent: HTMLElement | null = host; parent; parent = parent.parentElement) {
    themeObserver.observe(parent, { attributes: true, attributeFilter: ['class', 'style', 'tuiTheme'] });
  }
  view.addEventListener('resize', refresh);
  view.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', updateMotion);
  motion.addEventListener('change', updateMotion);
  refresh();

  return () => {
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    view.removeEventListener('resize', refresh);
    view.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', updateMotion);
    motion.removeEventListener('change', updateMotion);
    canvas.remove();
    host.classList.remove('ui-wobble-ready');
  };
}
