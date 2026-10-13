import { mkdir, writeFile, rename, rm, readFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';
import express from 'express';
import puppeteer from 'puppeteer';
import { profiles, warmupRoutes } from './profiles.mjs';
import { Motion, installPointer } from './motion.mjs';
import { startCapture, encode } from './capture.mjs';
import { writeGallery } from './gallery.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { values } = parseArgs({ options: {
  profile: { type: 'string', default: 'all' },
  url: { type: 'string' },
  output: { type: 'string' },
  'skip-build': { type: 'boolean', default: false },
  preview: { type: 'boolean', default: false },
  countdown: { type: 'string', default: '5' },
  help: { type: 'boolean', default: false },
} });
if (values.help) {
  console.log(`Usage: npm run record:app -- [options]
  --profile all|${Object.keys(profiles).join('|')} (comma-separated supported)
  --url http://localhost:4300  Use a running app instead of building and serving
  --skip-build                Serve the existing local build
  --output path               Output directory (default: timestamped artifacts/recordings)
  --preview                   Run visibly without encoding video (one profile)
  --countdown 5               Seconds to wait before a visible preview begins

Each profile produces a full walkthrough, a discovery showcase, a 15-second ad,
chapter screenshots, and a JSON manifest. The output gallery links every clip.`);
  process.exit(0);
}
const names = values.profile === 'all' ? Object.keys(profiles) : values.profile.split(',');
if (names.some((name) => !profiles[name]) || new Set(names).size !== names.length) {
  throw new Error(`Choose unique profiles from ${Object.keys(profiles).join(', ')}`);
}
if (values.preview && names.length !== 1) throw new Error('--preview needs one --profile');
const countdown = Number(values.countdown);
if (!Number.isFinite(countdown) || countdown < 0 || countdown > 60) throw new Error('--countdown must be 0–60 seconds');
const output = path.resolve(root, values.output ?? `artifacts/recordings/${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(output, { recursive: true });

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

let server, browser;
const results = [];
// Preserve completed sizes when refreshing selected profiles in an existing run.
for (const name of Object.keys(profiles).filter((name) => !names.includes(name))) {
  try {
    const prior = JSON.parse(await readFile(path.join(output, name, 'manifest.json'), 'utf8'));
    if (prior.status === 'complete') results.push(prior);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
try {
  let url = values.url;
  if (!url) {
    if (!values['skip-build']) {
      await run(process.execPath, ['node_modules/nx/bin/nx.js', 'build', 'aggregator-csr', '--configuration=development'], {
        env: { ...process.env, NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false' },
      });
    }
    const directory = path.join(root, 'dist/apps/portals/aggregator/entrypoints/csr');
    await readFile(path.join(directory, 'index.html'));
    const app = express();
    app.use(express.static(directory));
    app.get('*', (_, response) => response.sendFile(path.join(directory, 'index.html')));
    await new Promise((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', resolve);
      server.on('error', reject);
    });
    url = `http://127.0.0.1:${server.address().port}`;
  }
  const base = new URL(url);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('--url must use HTTP or HTTPS');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
  browser = await puppeteer.launch({ headless: !values.preview, args: ['--hide-scrollbars'] });
  for (const name of names) {
    const profile = profiles[name];
    const destination = path.join(output, name);
    await mkdir(destination, { recursive: true });
    const context = await browser.createBrowserContext();
    let capture;
    const manifest = {
      profile: name, ...profile, revision, dirty, url: base.origin,
      createdAt: new Date().toISOString(), browser: await browser.version(),
      source: values.url ? 'running-server' : 'local-development-build',
      theme: 'application default', chapters: [], errors: [], warnings: [], clips: [],
    };
    const page = await context.newPage();
    await page.setViewport({ width: profile.width, height: profile.height, deviceScaleFactor: 1,
      isMobile: profile.touch, hasTouch: profile.touch });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    page.on('pageerror', (error) => manifest.errors.push(error.message));
    const motion = new Motion(page, profile);
    const raw = path.join(destination, 'capture.mp4');
    console.log(`[${name}] Warming routes at ${profile.width}×${profile.height}`);
    try {
      // Warm the route bundles and images before the camera starts. Each profile
      // has a fresh context; no existing account or personal storage is reused.
      for (const route of warmupRoutes) {
        await page.goto(new URL(route, base).href, { waitUntil: 'networkidle0' });
        await motion.ready();
      }
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle0' });
      await motion.ready();
      await motion.hold(2500);
      await installPointer(page, profile.touch);
      if (manifest.errors.length) throw new Error(`App errors during preparation: ${manifest.errors.join('; ')}`);
      if (values.preview) {
        console.log(`[${name}] Preview starts in ${countdown}s. Record this browser window with your preferred recorder.`);
        await page.bringToFront();
        await motion.hold(countdown * 1000);
      } else {
        capture = await startCapture(page, raw, profile);
      }
      const started = performance.now();
      const time = () => capture ? capture.time() : (performance.now() - started) / 1000;
      const chapter = async (id, title) => {
        const timestamp = time();
        const health = await page.evaluate(() => ({
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          viewport: { width: innerWidth, height: innerHeight },
          route: location.pathname + location.search,
          brokenVisibleImages: [...document.images].filter((image) => {
            const box = image.getBoundingClientRect();
            return box.width && box.bottom > 0 && box.top < innerHeight && image.complete && !image.naturalWidth;
          }).map((image) => image.currentSrc),
        }));
        if (health.horizontalOverflow) throw new Error(`Horizontal overflow at ${id}`);
        if (health.viewport.width !== profile.width) throw new Error(`Unexpected viewport at ${id}`);
        if (health.brokenVisibleImages.length) manifest.warnings.push({ chapter: id, brokenImages: health.brokenVisibleImages });
        const screenshot = `${String(manifest.chapters.length + 1).padStart(2, '0')}-${id}.png`;
        await page.screenshot({ path: path.join(destination, screenshot) });
        manifest.chapters.push({ id, title, time: timestamp, screenshot, route: health.route });
        console.log(`[${name}] ${timestamp.toFixed(1)}s · ${title}`);
        return timestamp;
      };

      await chapter('explore', 'Explore the feed');
      await motion.hold(1400);
      await motion.scrollBy(0.52, 3000);
      await motion.hold(1000);

      const showcaseStart = time();
      await motion.navigate('/discover');
      await chapter('discover', 'Discover applications');
      await motion.hold(850);
      const adStart = time();
      await motion.type('main input[aria-label="Search"]', 'photo editing');
      await page.waitForSelector('main a[href="/apps/photo-snap/overview"]', { visible: true });
      await chapter('search', 'Find Photo Snap');
      await motion.hold(1100);
      await motion.click('main a[href="/apps/photo-snap/overview"]');
      await page.waitForFunction(() => location.pathname.includes('/apps/photo-snap'));
      await chapter('overview', 'Photo Snap overview');
      await motion.hold(2200);
      await motion.scrollBy(0.55, 3000);
      await motion.hold(Math.max(1800, (adStart + 15.3 - time()) * 1000));
      await chapter('app-details', 'Explore app details');
      await motion.click('main a[href="/apps/photo-snap/reviews"]');
      await page.waitForFunction(() => location.pathname.endsWith('/reviews'));
      await chapter('reviews', 'Read community reviews');
      await motion.hold(1800);
      await motion.scrollBy(0.4, 2600);
      await motion.hold(1700);
      const showcaseEnd = time();

      // App pages use contextual mobile navigation. Return through Explore to
      // access the global Digest and Suites destinations as a person would.
      await motion.navigate('/');
      await motion.hold(700);
      await motion.navigate('/digest');
      await chapter('digest', 'Catch up in Digest');
      await motion.hold(1600);
      await motion.scrollBy(0.52, 3000);
      await motion.hold(1000);
      await motion.click('main a[href="/articles/design-principles-modern-apps"]');
      await page.waitForSelector('main article h1', { visible: true });
      await chapter('article', 'Read an article');
      await motion.hold(2000);
      await motion.scrollBy(0.6, 3000);
      await motion.hold(1700);

      await motion.navigate('/suites');
      await chapter('suites', 'Browse curated suites');
      await motion.hold(1400);
      await motion.click('main .display-options-trigger');
      await chapter('display-options', 'Inspect display options');
      await motion.hold(1500);
      await page.keyboard.press('Escape');
      await motion.hold(400);
      await motion.scrollBy(0.55, 3000);
      await motion.hold(1100);
      await motion.click('main a[href="/suites/creative-tools-suite"]');
      await page.waitForSelector('#suite-apps-heading', { visible: true });
      await chapter('suite-detail', 'Explore the Creative Tools Suite');
      await motion.hold(2200);
      await motion.scrollBy(0.45, 3000);
      await motion.hold(1700);
      await motion.navigate('/');
      await chapter('closing', 'Return to Explore');
      await motion.hold(2400);
      if (manifest.errors.length) throw new Error(`App runtime errors: ${manifest.errors.join('; ')}`);

      if (capture) {
        manifest.capture = await capture.stop(); capture = undefined;
        console.log(`[${name}] Exporting walkthrough, showcase, and 15-second ad`);
        for (const clip of [
          { name: 'walkthrough', start: 0, duration: manifest.capture.duration },
          { name: 'showcase', start: showcaseStart, duration: showcaseEnd - showcaseStart },
          { name: 'ad', start: adStart, duration: 15 },
        ]) {
          await encode(['-ss', clip.start.toFixed(3), '-i', raw, '-t', clip.duration.toFixed(3),
            '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', path.join(destination, `${clip.name}.mp4`)]);
          manifest.clips.push({ ...clip, file: `${clip.name}.mp4` });
        }
        await rm(raw);
      }
      manifest.status = 'complete';
      results.push(manifest);
    } catch (error) {
      manifest.status = 'failed';
      manifest.errors.push(error.message);
      if (capture) {
        await capture.stop().catch(() => {}); capture = undefined;
        await rename(raw, path.join(destination, 'failed-capture.mp4')).catch(() => {});
      }
      await page.screenshot({ path: path.join(destination, 'failure.png') }).catch(() => {});
      throw error;
    } finally {
      await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server ? server.close(resolve) : resolve());
  await writeGallery(output, results);
  console.log(`Recordings: ${output}`);
}
