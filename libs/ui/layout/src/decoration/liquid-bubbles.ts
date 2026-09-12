type Point = { x: number; y: number };
type ContourNode = { point: Point; neighbors: number[] };

/** Stable random values per birth: nothing jumps or rerolls during a bubble's life. */
export function sampleLiquidBubbles(time: number, width: number, radius: number, rise: number, duration: number, count: number, seed: number) {
  const random = (key: number) => {
    let value = Math.imul(key ^ seed, 1597334677);
    value = Math.imul(value ^ (value >>> 16), 2246822507);
    return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
  };
  const total = Math.min(count, Math.max(1, Math.floor(width / 70)));
  const margin = Math.min(width / 4, radius * 2 + 4);
  const gap = Math.min(width / 6, 32 + radius);
  const space = Math.max(0, width - margin * 2 - gap * 2);
  const cell = space / Math.max(1, total);
  return Array.from({ length: total }, (_, i) => {
    const period = duration * (0.75 + random(i * 7) * 0.5);
    const clock = time / period + random(i * 7 + 1);
    const birth = Math.floor(clock), key = birth * 1013 + i * 7919;
    const size = Math.min(radius, cell * 0.25) * (0.45 + random(key + 2) * 0.55);
    // Jitter within disjoint neighborhoods, including while older blobs are still airborne.
    // The center gap stays clear for the heading; neighboring blobs cannot pile up.
    let x = margin + (i + 0.35 + random(key + 3) * 0.3) * cell;
    if (x > width / 2 - gap) x += gap * 2;
    return {
      x, radius: size, rise: rise * (0.65 + random(key + 4) * 0.35),
      lifetime: period * (0.8 + random(key + 5) * 0.2),
    };
  });
}

type Bubble = ReturnType<typeof sampleLiquidBubbles>[number];
type Wave = { height: number; base: number; velocity: number };
export type BubblePhysics = {
  buoyancy: number; tension: number; damping: number;
  growthStart: number; releaseHeight: number;
};
export type LiquidBubble = { x: number; y: number; radius: number; stretch: number; skew: number };
type BubbleState = {
  bubble: Bubble; y: number; velocity: number;
  volume: number; stretch: number; deformationVelocity: number;
  detachedAt?: number; replenished: boolean;
};

/** A buoyant mass tethered to the surface. Its shared distance field determines pinch-off. */
export function createLiquidBubbleMotion() {
  let previous: number | undefined;
  const states: BubbleState[] = [];
  return (time: number, candidates: Bubble[], waveAt: (x: number, time: number) => Wave, physics: BubblePhysics) => {
    // Small integration steps preserve inertia at different refresh rates. Never catch up a hidden tab.
    const delta = Math.max(0, Math.min(64, time - (previous ?? time))) / 1000;
    const steps = Math.max(1, Math.ceil(delta * 120)), dt = delta / steps;
    previous = time;
    states.length = candidates.length;
    return candidates.map((candidate, i) => {
      const fresh = (replenished = true): BubbleState => ({
        bubble: candidate, y: waveAt(candidate.x, time).base + candidate.radius * 1.3,
        velocity: 0, volume: 0, stretch: 1, deformationVelocity: 0, replenished,
      });
      const state = states[i] ??= fresh();
      const { bubble } = state;
      const r = bubble.radius;
      if (r <= 0) return { x: bubble.x, y: state.y, radius: 0, stretch: 1, skew: 0, velocity: 0, attached: true };
      let shape: LiquidBubble;
      for (let step = 0; step < steps; step++) {
        const wave = waveAt(bubble.x, time - delta * 1000 + (step + 1) * dt * 1000);
        const attached = state.detachedAt === undefined;
        if (attached) {
          // A spent reservoir refills below the next wave, preventing repeated bursts from one crest.
          if (wave.height < physics.growthStart) state.replenished = true;
          const pressure = state.replenished ? ease((wave.height - physics.growthStart) / (1 - physics.growthStart)) : 0;
          // The reservoir fills continuously; stronger crests weaken the tether without a release timer.
          state.volume += (Math.sqrt(pressure) - state.volume) * (1 - Math.exp(-dt * 6));
          const crest = ease((wave.height - physics.releaseHeight) / (1 - physics.releaseHeight));
          const stiffness = physics.tension * (1 - 0.8 * crest);
          const mass = 0.8 + bubble.lifetime / 20_000;
          const tension = stiffness * (wave.base + r * 1.3 - state.y);
          const buoyancy = -r * physics.buoyancy * pressure * state.volume;
          state.velocity += ((tension + buoyancy) / mass + physics.damping * (wave.velocity - state.velocity)) * dt;
        } else {
          // Keep the same world position and velocity at separation; the falling wave cannot drag it down.
          state.velocity += (-r * physics.buoyancy * 0.07 - state.velocity * 1.4) * dt;
        }
        state.y += state.velocity * dt;
        const relativeVelocity = state.velocity - (attached ? wave.velocity : 0);
        const targetStretch = attached ? 1 + Math.min(0.5, Math.max(-0.12, -relativeVelocity / (r * 10))) : 1;
        // A damped shape mode stores the neck's stretch and recoils naturally after separation.
        state.deformationVelocity += ((targetStretch - state.stretch) * 65 - state.deformationVelocity * 5) * dt;
        state.stretch += state.deformationVelocity * dt;
        const travel = attached ? 0 : Math.max(0, state.detachedAt! - state.y);
        const shrink = 1 - ease((travel / Math.max(1, bubble.rise) - 0.35) / 0.65);
        shape = { x: bubble.x, y: state.y, radius: r * state.volume * shrink,
          stretch: state.stretch, skew: Math.min(0.12, Math.max(-0.12, state.deformationVelocity * 0.08)) };
        if (attached && shape.radius > 1 && relativeVelocity < 0 && neckField(shape, wave.base) >= 0) {
          state.detachedAt = state.y;
        }
        if (!attached && travel >= bubble.rise) {
          states[i] = fresh(false);
          shape.radius = 0;
          break;
        }
      }
      return { ...shape!, velocity: state.velocity, attached: state.detachedAt === undefined };
    });
  };
}

const ease = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

/** Polynomial smooth union: the shared zero contour forms and pinches a liquid neck. */
function merge(a: number, b: number, tension: number): number {
  const h = Math.max(tension - Math.abs(a - b), 0) / tension;
  return Math.min(a, b) - h * h * tension * 0.25;
}

/** Marching squares with interpolated crossings; closed contours also survive pinch-off. */
function contours(left: number, top: number, right: number, bottom: number, field: (x: number, y: number) => number): Point[][] {
  const resolution = Math.max(0.75, Math.min(2, (right - left) / 24));
  const columns = Math.ceil((right - left) / resolution), rows = Math.ceil((bottom - top) / resolution);
  const dx = (right - left) / columns, dy = (bottom - top) / rows;
  const stride = columns + 1;
  const values = new Float32Array(stride * (rows + 1));
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
    // Enclose the patch inside the backing so its bottom/side joins remain hidden.
    values[y * stride + x] = x === 0 || y === 0 || x === columns || y === rows ? 1 : field(left + x * dx, top + y * dy);
  }
  const nodes = new Map<number, ContourNode>();
  const cases = [[], [3, 0], [0, 1], [3, 1], [1, 2], [], [0, 2], [3, 2],
    [2, 3], [2, 0], [], [2, 1], [1, 3], [1, 0], [0, 3], []];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const a = y * stride + x;
    const corners = [a, a + 1, a + stride + 1, a + stride];
    const mask = corners.reduce((m, id, i) => m | (values[id] < 0 ? 1 << i : 0), 0);
    let pairs = cases[mask];
    if (mask === 5 || mask === 10) {
      const inside = field(left + (x + 0.5) * dx, top + (y + 0.5) * dy) < 0;
      pairs = (mask === 5) === inside ? [3, 2, 0, 1] : [3, 0, 1, 2];
    }
    const crossing = (edge: number) => {
      const first = corners[edge], second = corners[(edge + 1) % 4];
      const id = Math.min(first, second) * 2 + (Math.abs(first - second) === 1 ? 0 : 1);
      if (!nodes.has(id)) {
        const t = values[first] / (values[first] - values[second]);
        nodes.set(id, { point: {
          x: left + ((first % stride) + ((second % stride) - (first % stride)) * t) * dx,
          y: top + (Math.floor(first / stride) + (Math.floor(second / stride) - Math.floor(first / stride)) * t) * dy,
        }, neighbors: [] });
      }
      return id;
    };
    for (let i = 0; i < pairs.length; i += 2) {
      const first = crossing(pairs[i]), second = crossing(pairs[i + 1]);
      nodes.get(first)!.neighbors.push(second);
      nodes.get(second)!.neighbors.push(first);
    }
  }
  const paths: Point[][] = [];
  const visited = new Set<number>();
  for (const first of nodes.keys()) {
    if (visited.has(first)) continue;
    const path: Point[] = [];
    let current: number | undefined = first;
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      const node: ContourNode = nodes.get(current)!;
      path.push(node.point);
      current = node.neighbors.find(id => !visited.has(id));
    }
    if (path.length > 2) paths.push(path);
  }
  return paths;
}

/** Elliptic distance with a small deformation mode; stretch approximately preserves area. */
function dropletDistance(blob: LiquidBubble, x: number, y: number): number {
  const u = (x - blob.x) * blob.stretch, v = (y - blob.y) / blob.stretch;
  const distance = Math.hypot(u, v);
  const nx = u / (distance || 1), ny = v / (distance || 1);
  return distance - blob.radius * (1 + blob.skew * (3 * nx * nx * ny - ny * ny * ny));
}

/** Maximum field value along the neck: zero means there is no longer a fluid connection. */
function neckField(blob: LiquidBubble, surfaceY: number): number {
  if (blob.y >= surfaceY) return -blob.radius;
  let narrowest = -Infinity;
  for (let i = 1; i < 16; i++) {
    const y = blob.y + (surfaceY - blob.y) * i / 16;
    narrowest = Math.max(narrowest, merge(surfaceY - y, dropletDistance(blob, blob.x, y), blob.radius * 0.95));
  }
  return narrowest;
}

/** Render the actual mass and surface with the same field used to detect a broken neck. */
export function liquidBubbleContours(blob: LiquidBubble, surface: (x: number) => number): Point[][] {
  if (blob.radius < 0.15) return [];
  const r = blob.radius;
  const base = surface(blob.x);
  const left = blob.x - r * 3, right = blob.x + r * 3;
  const top = Math.min(base, blob.y) - r * 2;
  const bottom = Math.max(base, blob.y) + r * 2;
  const surfaceCache = new Map<number, number>();
  return contours(left, top, right, bottom, (x, y) => {
    let edge = surfaceCache.get(x);
    if (edge === undefined) { edge = surface(x); surfaceCache.set(x, edge); }
    return merge(edge - y, dropletDistance(blob, x, y), r * 0.95);
  });
}
