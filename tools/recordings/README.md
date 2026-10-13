# Record the aggregator portal

The choreography lives beside the app and records the actual Angular UI. Run it
after meaningful UI changes to refresh footage at each responsive layout.

## Setup and run

Install the repository dependencies as usual, then install the isolated video
encoder once:

```sh
npm ci --prefix tools/recordings
npm run record:app
```

The command builds the current aggregator application, serves that build on an
available loopback port, records six sizes sequentially, and closes its browser
and server. The existing development server is unaffected. Chromium comes from
the repository's existing Puppeteer dependency. If its browser is missing, run
`npx puppeteer browsers install chrome`.

Outputs are under `artifacts/recordings/<timestamp>/` (ignored by Git). Open
`index.html` for the gallery. Each profile has:

- `walkthrough.mp4`: the complete journey, including Explore, search, app details,
  reviews, Digest, article reading, Suites, display options, and suite details.
- `showcase.mp4`: the continuous discovery → search → overview → reviews sequence.
- `ad.mp4`: a 15-second excerpt beginning with the search interaction.
- Numbered PNG stills at chapter boundaries.
- `manifest.json`: viewport, Git revision, working-tree status, browser version,
  source URL, actual capture duration/frame counts, chapter times, and warnings.

The three clips come from the same take. Excerpts are trimmed without speeding up
the interaction. They contain no added music, captions, zoom, or browser chrome.

```sh
# Record selected sizes. Build the current source first (the default).
npm run record:app -- --profile phone,desktop

# Reuse a build you have just verified.
npm run record:app -- --skip-build --profile tablet

# Record a running version instead of the locally built snapshot.
npm run record:app -- --url http://localhost:4300 --profile laptop

# Visible rehearsal for a window recorder, with a lead-in countdown.
npm run record:app -- --preview --profile desktop --countdown 8
```

Use a new output directory for each run. `--output <path>` chooses a specific
directory; filenames within a profile are replaced if reused. Preview mode runs
the entire choreography and creates chapter stills, without encoding MP4s.

## Responsive coverage

These are representative screen sizes on each side of the meaningful layout
changes, rather than recordings at every adjacent pixel. All dimensions are CSS
pixels, with a device scale factor of 1 and the browser's default 16px font size.

| Profile | Viewport | Layout represented |
| --- | --- | --- |
| `phone` | 390 × 844 | Narrow content, single-column suite cards, bottom navigation |
| `wide-phone` | 640 × 960 | Wider content, two-column suite cards, bottom navigation |
| `tablet` | 768 × 1024 | Portrait tablet, compact expandable navigation rails |
| `tablet-landscape` | 1024 × 768 | Landscape tablet, compact rails and shorter content area |
| `laptop` | 1152 × 800 | Full sidebars and fluid center column |
| `desktop` | 1920 × 1080 | Centered shell capped at 1280px, full sidebars |

Sources in this repo:

- `libs/ui/design-system/src/styles/_layout.scss`: phone breakpoint from Taiga UI;
  compact rails through `640 + 2 × 200 = 1040px`; large desktop at 1280px.
- `libs/ui/design-system/src/styles/_grid.scss`: 640px and 1280px container widths.
- `node_modules/@taiga-ui/core/styles/variables/media.scss`: mobile max
  `47.9625em` (767.4px), tablet min `48em`, desktop large min `80em`.
- `apps/portals/aggregator/application/src/pages/results-page/results-page.component.scss`:
  cards become one column at a container width of 30rem (480px), and display
  options stack at a viewport width of 30rem.
- `apps/portals/aggregator/application/src/pages/discover/discover-page.component.scss`:
  article previews stack at a container width of 30rem.

Edit `profiles.mjs` when the app's layout thresholds change. These captures are
Chromium viewport emulation, not recordings from physical iOS/Android devices.

## Natural motion and editing

`motion.mjs` uses browser `requestAnimationFrame` animations with eased starts and
stops. Scrolls normally take three seconds; pointer paths curve slightly and
settle before clicking. Typing has small, repeatable timing differences. Phone
and tablet profiles use touch events with a brief tap indicator, without a mouse
pointer. Tablet navigation opens the actual rail before selecting a destination.
The app's own animations remain active.

The desktop pointer is an injected visual overlay; clicks and typing use real
browser input. Hover is applied when the pointer arrives at its destination.
This overlay is visible in a window recording, but does not create native OS
cursor metadata for Screen Studio's automatic cursor tracking. Use the MP4s as
finished raw footage, or use the visible rehearsal for a window recorder and add
zooms in the editor as needed.

Capture uses the repository's Puppeteer plus Chromium's screencast stream and a
pinned local FFmpeg encoder. MP4 output uses H.264, yuv420p, fast-start playback,
original viewport dimensions, and a 60fps output timeline. Chromium may deliver
fewer unique frames; timestamps determine repeated frames so pauses and movement
retain their real duration. Encoding to 60fps is not a claim of 60 unique frames
per second or motion interpolation. `receivedFrames` in the manifest records the
actual number of screencast frames received.

Each profile uses fresh browser storage and the app's default theme. The bundled
catalog, review statistics, relative dates, and external images remain the app's
own demo content. The script does not log in, publish, or alter account data. It
waits for visible content and fonts, reports broken visible images, and fails on
runtime errors, compiler overlays, obstructed clicks, or horizontal overflow.
On failure, inspect `failure.png`, `failed-capture.mp4` when available, and the
profile manifest. Completed earlier profiles remain available.

To change the story or pauses, edit the clearly named chapter sequence in
`record.mjs`. `showcaseStart`/`showcaseEnd` and `adStart` define the excerpts. Keep
the full 15-second ad window within the intended search and overview scene.

References: [MDN scrollTo](https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo),
[Puppeteer screencast](https://pptr.dev/api/puppeteer.page.screencast), and
[Playwright video sizing](https://playwright.dev/docs/videos) for the alternative
recorder mentioned in the original workflow. Here we reuse Puppeteer already
installed in the repository, with explicit native viewport dimensions.

### Full tablet navigation tour

`npm run record:tour` records the supplied 20-stage navigation checklist at a fixed
768 × 1024 viewport. It uses the running portal at `http://localhost:4040`, a fresh
isolated demo account, and defaults to **1.5× movement, typing and presentation
pauses**. Content-loading waits remain conditional. The original checklist's
changes to desktop/phone sizes are adapted to tablet navigation.

```sh
npm run record:tour -- --url http://localhost:4040 --speed 1.5 --output artifacts/recordings/tablet-tour
npm run record:tour -- --preflight --output tmp/tablet-tour/preflight
```

The full tour demonstrates local replies/discussions, favorites, a suite, an
application draft and ownership notes, and profile/preferences updates. These
stay in the isolated browser's storage; only its newly created demo application
and ownership notes are deleted during the tour. The browser uses the portal's
copy-link/manual-copy behavior instead of an operating-system share sheet.

`tour-scenario.mjs` contains the chapter choreography. `tour-driver.mjs` provides
smooth scrolling, native taps/typing, conditional readiness checks, and the speed
factor. Capture writes chapter parts, checkpoints, screenshots, the actual local
settings export, a manifest, and **20 separate chapter MP4s**.
`index.html` plays each clip separately and provides individual download links. Rehearsal does not encode video.

To resume a failed chapter, use the same output directory and `--from N`. The
runner restores that chapter's isolated local/session storage checkpoint. The
browser history stack is not restored; each chapter establishes its own route.
Earlier completed video parts remain intact. Do not use these demo checkpoints
in a personal browser session. The script leaves the app's source unchanged.

The supplied checklist describes commit `e833a662`; the running server determines
which UI is recorded. The tablet runner does not rebuild or update that server.
For this capture, `localhost:4040` serves the checklist's checkout. Use `--url` to
record another running version while preserving one origin for the entire tour.

After a complete recording, verify its full decode, dimensions, frame rate,
individual chapter durations, and browser playback of every clip:

```sh
node tools/recordings/verify-tour.mjs artifacts/recordings/tablet-tour
```
