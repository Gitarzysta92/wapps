const TEXTURE_SIZE = 256;
const LAYERS = [
  { x: 0.91, y: 0.12, scale: 1.15, angle: -0.5, depth: 0.14 },
  { x: 0.06, y: 0.66, scale: 0.95, angle: 0.6, depth: 0.28 },
  { x: 0.76, y: 1.04, scale: 1.3, angle: -0.25, depth: 0.44 },
];

interface NebulaCloud {
  layer: number;
  cell: number;
  x: number;
  y: number;
  size: number;
  angle: number;
}

/** Sample an unbounded world using only the cells intersecting the viewport. */
export function getNebulaClouds(width: number, height: number, scrollY: number): NebulaCloud[] {
  const clouds: NebulaCloud[] = [];
  const size = Math.min(1150, Math.max(380, width * 0.68));
  LAYERS.forEach((layer, index) => {
    const period = Math.max(height * 1.6, size * 1.8);
    const travel = Math.max(0, scrollY) * layer.depth;
    const origin = height * layer.y;
    // Includes the largest rotated cloud and its deterministic vertical variation.
    const reach = size * layer.scale * 0.85 + period * 0.08;
    const first = Math.floor((travel - origin - reach) / period);
    const last = Math.ceil((travel + height - origin + reach) / period);
    for (let cell = first; cell <= last; cell++) {
      const variation = noise(cell, index, 271) - 0.5;
      const cloudSize = size * layer.scale * (1 + variation * 0.2);
      const y = origin + cell * period + variation * period * 0.16 - travel;
      if (y + cloudSize * 0.72 < 0 || y - cloudSize * 0.72 > height) continue;
      clouds.push({
        layer: index, cell,
        x: width * (layer.x + variation * 0.08),
        y, size: cloudSize, angle: layer.angle + variation * 0.4,
      });
    }
  });
  return clouds;
}

// Seeded value noise keeps cloud shapes stable across resize and theme changes.
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const hash = (a: number, b: number) => {
    let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function cloudMask(document: Document, seed: number): HTMLCanvasElement {
  const mask = document.createElement('canvas');
  mask.width = mask.height = TEXTURE_SIZE;
  const context = mask.getContext('2d');
  if (!context) return mask;
  const image = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const nx = x / TEXTURE_SIZE * 2 - 1, ny = y / TEXTURE_SIZE * 2 - 1;
      const bend = ny + Math.sin(nx * 3 + seed) * 0.19;
      const falloff = Math.pow(Math.max(0, 1 - nx * nx - bend * bend), 2);
      let density = 0, amplitude = 0.55, frequency = 4;
      const warpX = noise(nx * 2 + 5, ny * 2 + 5, seed) * 0.65;
      const warpY = noise(nx * 2 + 17, ny * 2 - 7, seed + 37) * 0.65;
      for (let octave = 0; octave < 5; octave++) {
        density += noise((nx + warpX) * frequency + 20, (bend + warpY) * frequency + 20, seed) * amplitude;
        frequency *= 2;
        amplitude *= 0.5;
      }
      const alpha = Math.min(1, Math.max(0, density - 0.27) * 2.2) * falloff;
      const index = (y * TEXTURE_SIZE + x) * 4;
      image.data[index] = image.data[index + 1] = image.data[index + 2] = 255;
      image.data[index + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  return mask;
}

/** Transparent decoration; the host's theme owns its palette and intensity. */
export function createNebulaCanvas(canvas: HTMLCanvasElement, host: HTMLElement): () => void {
  const document = canvas.ownerDocument;
  const view = document.defaultView;
  const context = canvas.getContext('2d');
  if (!view || !context) return () => undefined;

  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const masks = LAYERS.map((_, i) => cloudMask(document, 73 + i * 131));
  let textures: HTMLCanvasElement[] = [];
  let palette = '', starColor = '', opacity = 0;
  let width = 0, height = 0, ratio = 1;
  let frame: number | undefined;

  const readTheme = () => {
    const style = view.getComputedStyle(host);
    const colors = LAYERS.map((_, i) => style.getPropertyValue(`--nebula-color-${i + 1}`).trim());
    opacity = Math.max(0, Math.min(1, Number(style.getPropertyValue('--nebula-opacity')) || 0));
    starColor = style.getPropertyValue('--nebula-star-color').trim();
    const nextPalette = colors.join('|');
    if (nextPalette === palette) return;
    palette = nextPalette;
    textures = masks.map((mask, i) => {
      const texture = document.createElement('canvas');
      texture.width = texture.height = TEXTURE_SIZE;
      const paint = texture.getContext('2d');
      if (paint && colors[i]) {
        paint.drawImage(mask, 0, 0);
        paint.globalCompositeOperation = 'source-in';
        paint.fillStyle = colors[i];
        paint.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      }
      return texture;
    });
  };

  const draw = () => {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const scroll = motion.matches ? 0 : Math.max(0, view.scrollY);
    getNebulaClouds(width, height, scroll).forEach(cloud => {
      if (!textures[cloud.layer]) return;
      context.save();
      context.translate(cloud.x, cloud.y);
      context.rotate(cloud.angle);
      context.globalAlpha = opacity;
      context.drawImage(textures[cloud.layer], -cloud.size / 2, -cloud.size / 2, cloud.size, cloud.size);
      context.restore();
    });
    if (!starColor) return;
    context.fillStyle = starColor;
    for (let i = 0; i < (width < 600 ? 24 : 64); i++) {
      const u = noise(i, 3, 917), v = noise(i, 7, 419);
      // Keep the central reading column quiet.
      if (u > 0.23 && u < 0.77) continue;
      const depth = 0.06 + (i % 3) * 0.04;
      // Wrap outside the visible area so stars cross the edge without popping.
      const period = height + 4;
      const y = ((v * period - scroll * depth) % period + period) % period - 2;
      context.beginPath();
      context.arc(u * width, y, i % 7 === 0 ? 1.2 : 0.65, 0, Math.PI * 2);
      context.fill();
    }
  };

  const requestDraw = () => {
    if (frame !== undefined || document.hidden) return;
    frame = view.requestAnimationFrame(() => {
      frame = undefined;
      draw();
    });
  };
  const updateMotion = () => {
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    frame = undefined;
    requestDraw();
  };
  const resize = () => {
    const bounds = host.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    ratio = Math.min(view.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    draw();
  };
  const onScroll = () => { if (!motion.matches) requestDraw(); };
  const themeStyle = (value: string | null) => (value || '').split(';').map(part => part.trim())
    .filter(part => part && !part.startsWith('--decoration-fade-progress:')).join(';');
  const themeObserver = new view.MutationObserver((records = []) => {
    if (records.length && records.every(record => record.attributeName === 'style' &&
      themeStyle(record.oldValue) === themeStyle((record.target as Element).getAttribute('style')))) return;
    readTheme(); requestDraw();
  });
  for (let parent: HTMLElement | null = host; parent; parent = parent.parentElement) {
    themeObserver.observe(parent, { attributes: true, attributeOldValue: true, attributeFilter: ['class', 'tuiTheme', 'style'] });
  }
  const resizeObserver = new view.ResizeObserver(resize);
  resizeObserver.observe(host);
  view.addEventListener('resize', resize);
  view.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', updateMotion);
  motion.addEventListener('change', updateMotion);
  readTheme();
  resize();

  return () => {
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    view.removeEventListener('resize', resize);
    view.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', updateMotion);
    motion.removeEventListener('change', updateMotion);
  };
}
