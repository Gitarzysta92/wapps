import puppeteer from 'puppeteer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { TourDriver } from './tour-driver.mjs';
import { installPointer } from './motion.mjs';
import { startCapture } from './capture.mjs';
import { writeTourGallery } from './tour-gallery.mjs';
import { chapters } from './tour-scenario.mjs';

const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://localhost:4040' },
  output: { type: 'string', default: 'artifacts/recordings/2026-09-13-tablet-full-tour' },
  speed: { type: 'string', default: '1.5' },
  'source-revision': { type: 'string' },
  preflight: { type: 'boolean', default: false },
  from: { type: 'string', default: '1' },
  to: { type: 'string', default: '20' },
} });
const speed = Number(values.speed), first = Number(values.from), last = Number(values.to);
if (!(speed > 0 && speed <= 50) || !(first >= 1 && last <= chapters.length && first <= last)) throw new Error('Invalid speed or chapter range');
const output = path.resolve(values.output), url = new URL(values.url).origin;
if (values['source-revision'] && !/^[0-9a-f]{7,40}$/i.test(values['source-revision'])) throw new Error('--source-revision must be a Git commit hash');
await mkdir(output, { recursive: true });
await mkdir(path.join(output, 'parts'), { recursive: true });
await mkdir(path.join(output, 'checkpoints'), { recursive: true });
await mkdir(path.join(output, 'downloads'), { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--hide-scrollbars', '--disable-blink-features=WebShare'] });
const context = await browser.createBrowserContext();
await context.overridePermissions(url, ['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1, hasTouch: true, isMobile: false });
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', browserContextId: context.id, downloadPath: path.join(output, 'downloads'), eventsEnabled: true });
let manifest = { title: 'Aggregator portal — complete tablet walkthrough', width: 768, height: 1024,
  speed, origin: url, createdAt: new Date().toISOString(), browser: await browser.version(),
  capture: 'Actual browser interaction; silent; touch indicators; H.264 at 60 fps',
  adaptations: ['Fixed 768 × 1024 throughout; desktop and phone checks adapted to tablet navigation.',
    `Movement, typing and presentation pauses run at ${speed}×; content readiness waits remain conditional.`,
    'Fresh isolated local demo session; all created content is local to the recording browser.'],
  chapters: [], errors: [], status: 'running' };
if (first > 1 && !values.preflight) manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
if (manifest.origin !== url || manifest.speed !== speed) { await browser.close(); throw new Error('Resume with the same origin and speed as the existing recording'); }
manifest.status = 'running'; manifest.format = 'separate-chapter-clips'; delete manifest.video; delete manifest.failure;
if (values['source-revision']) manifest.sourceRevision = values['source-revision'];
let capture;
try {
  await page.goto(url, { waitUntil: 'networkidle0' });
  if (first > 1) {
    const state = JSON.parse(await readFile(path.join(output, 'checkpoints', `${first}.json`), 'utf8'));
    await page.evaluate((state) => {
      localStorage.clear(); sessionStorage.clear();
      for (const [key, value] of Object.entries(state.local)) localStorage.setItem(key, value);
      for (const [key, value] of Object.entries(state.session)) sessionStorage.setItem(key, value);
    }, state);
    await page.goto(state.url, { waitUntil: 'networkidle0' });
  }
  await installPointer(page, true);
  const driver = new TourDriver(page, { pace: values.preflight ? 0.02 : 1 / speed,
    log: (action, detail) => console.log(`[${new Date().toISOString().slice(11,19)}] ${action}: ${detail}`) });
  driver.output = output;
  await driver.ready();
  page.on('pageerror', (error) => manifest.errors.push(String(error)));
  for (let i = first - 1; i < last; i++) {
    const chapter = chapters[i], number = i + 1, id = String(number).padStart(2, '0');
    console.log(`CHAPTER ${number}/${chapters.length}: ${chapter.title}`);
    const state = await page.evaluate(() => ({ url: location.href, local: { ...localStorage }, session: { ...sessionStorage } }));
    await writeFile(path.join(output, 'checkpoints', `${number}.json`), JSON.stringify(state));
    if (!values.preflight) capture = await startCapture(page, path.join(output, 'parts', `${id}.mp4`), { width: 768, height: 1024 });
    await driver.hold(1700);
    await chapter.run(driver);
    await driver.hold(2500);
    await page.screenshot({ path: path.join(output, 'parts', `${id}.png`) });
    if (capture) {
      const stats = await capture.stop(); capture = undefined;
      manifest.chapters = manifest.chapters.filter((entry) => entry.number !== number);
      manifest.chapters.push({ number, title: chapter.title, ...stats, file: `parts/${id}.mp4`, screenshot: `parts/${id}.png` });
      await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }
    console.log(`COMPLETE ${number}: ${chapter.title}`);
    const nextState = await page.evaluate(() => ({ url: location.href, local: { ...localStorage }, session: { ...sessionStorage } }));
    await writeFile(path.join(output, 'checkpoints', `${number + 1}.json`), JSON.stringify(nextState));
  }
  if (!values.preflight && last === chapters.length && manifest.chapters.length === chapters.length) {
    manifest.chapters.sort((a, b) => a.number - b.number);
    let start = 0;
    for (const chapter of manifest.chapters) { delete chapter.start; start += chapter.duration; }
    manifest.duration = start;
    manifest.status = 'complete';
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await writeTourGallery(output, manifest);
  }
} catch (error) {
  console.error(error);
  manifest.status = 'failed'; manifest.failure = String(error);
  if (capture) { await capture.stop().catch(console.error); capture = undefined; }
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(()=>{});
  await writeFile(path.join(output, 'failure.html'), await page.content()).catch(()=>{});
  await writeFile(path.join(output, 'failure.json'), JSON.stringify(await page.evaluate(() => ({ url:location.href, text:document.body.innerText, controls:[...document.querySelectorAll('a,button,input,textarea,select')].filter(el=>el.getBoundingClientRect().width).map(el=>({tag:el.tagName,text:el.innerText,aria:el.getAttribute('aria-label'),href:el.getAttribute('href'),id:el.id,name:el.getAttribute('name'),type:el.getAttribute('type')})) })), null, 2)).catch(()=>{});
  if (!values.preflight) await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest,null,2));
  process.exitCode = 1;
} finally { await browser.close(); }
