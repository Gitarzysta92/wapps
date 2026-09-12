import { BubblePhysics, createLiquidBubbleMotion, LiquidBubble, liquidBubbleContours, sampleLiquidBubbles } from '../../../../../../../libs/ui/layout/src/decoration/liquid-bubbles';

const physics: BubblePhysics = { buoyancy: 100, tension: 32, damping: 10, growthStart: 0.35, releaseHeight: 0.75 };
const candidate = { x: 120, radius: 12, rise: 40, lifetime: 7000 };
const risingWave = (_x: number, time: number) => {
  const height = Math.min(1, 0.15 + time / 4000 * 0.85);
  return { height, base: -24 * height, velocity: time < 4000 ? -24 * 0.85 / 4 : 0 };
};

function rollingWave(width: number, x: number, time: number) {
  const phase = time / 16000 * Math.PI * 2, k = x / 220 * Math.PI * 2;
  const taper = Math.sin(Math.min(1, Math.max(0, Math.min(x, width - x)) / 64) * Math.PI / 2) ** 2;
  const height = (0.5 + 0.5 * (Math.sin(k + phase) * 0.65 + Math.sin(k * 0.55 - phase * 2) * 0.35)) * taper;
  const velocity = -12 * (Math.cos(k + phase) * 0.65 - Math.cos(k * 0.55 - phase * 2) * 0.7) * taper * Math.PI * 2 / 16;
  return { height, base: -24 * height, velocity };
}

describe('continuous liquid motion', () => {
  it('stays submerged on low waves regardless of elapsed time', () => {
    const motion = createLiquidBubbleMotion();
    const low = () => ({ height: 0.2, base: -5, velocity: 0 });
    let blob = motion(0, [candidate], low, physics)[0];
    for (let time = 16; time <= 20_000; time += 16) blob = motion(time, [candidate], low, physics)[0];
    expect(blob.radius).toBe(0);
    expect(blob.attached).toBe(true);
    expect(liquidBubbleContours(blob, () => -5)).toEqual([]);
  });

  it('grows with the wave and preserves position, velocity and shape across geometric pinch-off', () => {
    const motion = createLiquidBubbleMotion();
    let before = motion(0, [candidate], risingWave, physics)[0];
    let released = false;
    const sizes: number[] = [];
    for (let time = 16; time <= 4200; time += 16) {
      const blob = motion(time, [candidate], risingWave, physics)[0];
      if (time % 400 === 0 && time <= 3200) sizes.push(blob.radius);
      if (before.attached && !blob.attached) {
        released = true;
        expect(risingWave(blob.x, time).height).toBeGreaterThan(physics.releaseHeight);
        expect(blob.y).toBeLessThan(before.y);
        expect(before.y - blob.y).toBeLessThan(2);
        expect(Math.abs(blob.velocity - before.velocity)).toBeLessThan(4);
        expect(Math.abs(blob.stretch - before.stretch)).toBeLessThan(0.06);
        expect(liquidBubbleContours(blob, x => risingWave(x, time).base)).toHaveLength(2);
        // A suddenly falling surface cannot change the airborne trajectory.
        const after = motion(time + 16, [candidate], () => ({ height: 0.1, base: 0, velocity: 40 }), physics)[0];
        expect(after.y).toBeLessThan(blob.y);
        expect(Math.abs(after.velocity - blob.velocity)).toBeLessThan(4);
        break;
      }
      before = blob;
    }
    expect(released).toBe(true);
    expect(sizes[3]).toBeGreaterThan(sizes[2]);
    expect(sizes[5]).toBeGreaterThan(sizes[4]);
    expect(sizes[7]).toBeGreaterThan(sizes[6]);
  });

  it('responds to buoyancy and surface tension instead of releasing at a prescribed time', () => {
    const release = (settings: BubblePhysics) => {
      const motion = createLiquidBubbleMotion();
      for (let time = 0; time <= 6000; time += 16) {
        if (!motion(time, [candidate], risingWave, settings)[0].attached) return time;
      }
      return Infinity;
    };
    expect(release({ ...physics, tension: 42 })).toBeGreaterThan(release(physics));
    expect(release({ ...physics, buoyancy: 85 })).toBeGreaterThan(release(physics));
    expect(release({ ...physics, buoyancy: 1 })).toBe(Infinity);
  });

  it('recedes when a crest is too weak and emits at most once from a sustained crest', () => {
    const motion = createLiquidBubbleMotion();
    const weak = (_x: number, time: number) => {
      const height = 0.2 + 0.48 * Math.sin(Math.min(time / 6000, 1) * Math.PI) ** 2;
      return { height, base: -24 * height, velocity: -24 * 0.48 * Math.sin(time / 3000 * Math.PI) * Math.PI / 6 };
    };
    let biggest = 0;
    for (let time = 0; time <= 8000; time += 16) {
      const blob = motion(time, [candidate], weak, physics)[0];
      biggest = Math.max(biggest, blob.radius);
      expect(blob.attached).toBe(true);
      if (time === 8000) expect(blob.radius).toBeLessThan(0.01);
    }
    expect(biggest).toBeGreaterThan(5);
    const other = createLiquidBubbleMotion();
    let wasAttached = true, releases = 0;
    for (let time = 0; time <= 16000; time += 16) {
      const blob = other(time, [candidate], risingWave, physics)[0];
      if (wasAttached && !blob.attached) releases++;
      wasAttached = blob.attached;
    }
    expect(releases).toBe(1);
  });

  it('is consistent across frame rates and bounds work after a long pause', () => {
    const sample = (step: number) => {
      const motion = createLiquidBubbleMotion();
      let blob = motion(0, [candidate], risingWave, physics)[0];
      for (let time = step; time <= 3200; time += step) blob = motion(time, [candidate], risingWave, physics)[0];
      return blob;
    };
    const fast = sample(8), slow = sample(32);
    expect(Math.abs(fast.y - slow.y)).toBeLessThan(0.1);
    expect(Math.abs(fast.velocity - slow.velocity)).toBeLessThan(0.1);
    expect(Math.abs(fast.radius - slow.radius)).toBeLessThan(0.1);
    const motion = createLiquidBubbleMotion();
    const wave = jest.fn(risingWave);
    motion(0, [candidate], wave, physics);
    wave.mockClear();
    const blob = motion(1e9, [candidate], wave, physics)[0];
    expect(wave.mock.calls.length).toBeLessThanOrEqual(8);
    expect(blob.attached).toBe(true);
    expect(Number.isFinite(blob.y + blob.velocity + blob.radius)).toBe(true);
  });

  it.each([351, 848])('releases at local crests and stays bounded at %ipx', width => {
    const motion = createLiquidBubbleMotion();
    let before: ReturnType<typeof motion> = [], releases = 0;
    for (let time = 0; time <= 32000; time += 32) {
      const blobs = motion(time, sampleLiquidBubbles(time, width, 18, 40, 7000, 10, 42), (x, t) => rollingWave(width, x, t), physics);
      blobs.forEach((blob, i) => {
        if (!blob.attached && before[i]?.attached) {
          releases++;
          expect(rollingWave(width, blob.x, time).height).toBeGreaterThanOrEqual(physics.releaseHeight);
        }
        expect(Number.isFinite(blob.y + blob.radius + blob.stretch)).toBe(true);
        expect(blob.y - blob.radius * 2).toBeGreaterThan(-110);
      });
      before = blobs;
    }
    expect(releases).toBeGreaterThan(5);
  });
});

describe('randomized bubble births', () => {
  const sample = (time: number, width = 848) => sampleLiquidBubbles(time, width, 18, 40, 7000, 10, 42);

  it('keeps each birth stable between frames and varies the next generation', () => {
    const first = sample(2000), nextFrame = sample(2001), later = sample(20000);
    expect(first).toEqual(sample(2000));
    expect(first.map(({ x, radius, rise }) => [x, radius, rise])).toEqual(nextFrame.map(({ x, radius, rise }) => [x, radius, rise]));
    expect(later.map(b => b.x)).not.toEqual(first.map(b => b.x));
    expect(new Set(first.map(b => b.lifetime)).size).toBe(10);
    expect(new Set(first.map(b => b.radius)).size).toBe(10);
  });

  it('limits density on mobile and keeps droplets clear of the heading and outer edges', () => {
    expect(sample(0)).toHaveLength(10);
    expect(sample(0, 320)).toHaveLength(4);
    for (const width of [320, 768, 848]) for (const time of [0, 2000, 10000, 1e9]) {
      for (const bubble of sample(time, width)) {
        expect(bubble.x - bubble.radius * 1.5).toBeGreaterThan(0);
        expect(bubble.x + bubble.radius * 1.5).toBeLessThan(width);
        expect(Math.abs(bubble.x - width / 2)).toBeGreaterThan(32 + bubble.radius);
        expect(bubble.lifetime).toBeGreaterThan(0);
      }
    }
  });

  it('preserves breathing room across seeds, generations, and independently aging blobs', () => {
    for (const width of [320, 390, 768, 848]) for (const seed of [1, 42, 9876]) {
      const before = sampleLiquidBubbles(0, width, 18, 40, 7000, 10, seed);
      const after = sampleLiquidBubbles(20_000, width, 18, 40, 7000, 10, seed);
      const mixed = before.map((b, i) => i % 2 ? after[i] : b);
      for (const bubbles of [before, after, mixed]) for (let i = 1; i < bubbles.length; i++) {
        expect(bubbles[i].x - bubbles[i - 1].x).toBeGreaterThan((bubbles[i].radius + bubbles[i - 1].radius) * 1.4);
      }
    }
  });
});

describe('liquid bubble contours', () => {
  const shape = (y: number, stretch = 1.2): LiquidBubble => ({ x: 120, y, radius: 12, stretch, skew: 0.06 });

  it('forms a neck and then separate contours from geometry alone', () => {
    const connected = liquidBubbleContours(shape(-10), () => 0);
    const detached = liquidBubbleContours(shape(-28), () => 0);
    expect(connected).toHaveLength(1);
    expect(detached).toHaveLength(2);
    expect(detached.some(path => path.every(p => p.y < 0))).toBe(true);
  });

  it('shows stretch and recoil while preserving approximate area', () => {
    const dimensions = (stretch: number) => {
      const path = liquidBubbleContours(shape(-40, stretch), () => 0).find(points => points.every(p => p.y < -10))!;
      return [Math.max(...path.map(p => p.x)) - Math.min(...path.map(p => p.x)), Math.max(...path.map(p => p.y)) - Math.min(...path.map(p => p.y))];
    };
    const round = dimensions(1), stretched = dimensions(1.4);
    expect(stretched[1]).toBeGreaterThan(round[1] * 1.3);
    expect(stretched[0]).toBeLessThan(round[0] * 0.8);
    expect(Math.abs(stretched[0] * stretched[1] / (round[0] * round[1]) - 1)).toBeLessThan(0.1);
    expect(liquidBubbleContours({ ...shape(-40), radius: 0 }, () => 0)).toEqual([]);
  });

  it('keeps mesh size and surface sampling bounded across sizes', () => {
    for (const radius of [0.2, 2, 6, 18]) for (const y of [10, -10, -40, -80]) {
      const surface = jest.fn((x: number) => 8 * Math.sin(x / 100));
      const paths = liquidBubbleContours({ ...shape(y), radius }, surface);
      expect(surface.mock.calls.length).toBeLessThan(200);
      expect(paths.flat().length).toBeLessThan(1500);
      expect(paths.flat().every(p => Number.isFinite(p.x + p.y))).toBe(true);
    }
  });
});
