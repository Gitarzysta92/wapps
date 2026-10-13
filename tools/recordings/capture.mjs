import { spawn } from 'node:child_process';
import { once } from 'node:events';
import ffmpeg from 'ffmpeg-static';

export function encode(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    let error = '';
    process.stderr.on('data', (data) => { error = (error + data).slice(-8000); });
    process.once('error', reject);
    process.once('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${error}`)));
  });
}

// CDP frames have variable timestamps. Repeat each frame for its actual duration,
// rather than speeding up still holds or slowing down busy scenes.
export async function startCapture(page, output, { width, height }, fps = 60) {
  const client = await page.createCDPSession();
  const process = spawn(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encoderError = '', failed, frames = 0, received = 0, previous, origin;
  let queue = Promise.resolve();
  const completion = new Promise((resolve, reject) => {
    process.once('error', reject);
    process.once('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${encoderError}`)));
  });
  completion.catch((error) => { failed = error; });
  process.stderr.on('data', (data) => { encoderError = (encoderError + data).slice(-8000); });
  process.stdin.on('error', (error) => { failed = error; });
  const writeThrough = async (target, buffer) => {
    while (frames < target) {
      if (failed) throw failed;
      if (!process.stdin.write(buffer)) await once(process.stdin, 'drain');
      frames++;
    }
  };
  let firstFrame;
  const first = new Promise((resolve) => { firstFrame = resolve; });
  client.on('Page.screencastFrame', (event) => {
    void client.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    const { timestamp } = event.metadata;
    if (timestamp === undefined) return;
    received++;
    if (!previous) {
      origin = performance.now();
      firstFrame();
    }
    const buffer = Buffer.from(event.data, 'base64');
    if (previous) {
      const target = Math.round((timestamp - previous.start) * fps);
      const prior = previous.buffer;
      queue = queue.then(() => writeThrough(target, prior)).catch((error) => { failed = error; });
    }
    previous = { buffer, start: previous?.start ?? timestamp };
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  let firstFrameTimeout;
  try {
    await Promise.race([first, completion.then(() => { throw new Error('Encoder exited before capture started'); }), new Promise((_, reject) => {
      firstFrameTimeout = setTimeout(() => reject(new Error('Chromium did not produce a video frame')), 10000);
    })]);
  } catch (error) {
    process.kill(); await client.detach(); throw error;
  } finally { clearTimeout(firstFrameTimeout); }
  return {
    time: () => (performance.now() - origin) / 1000,
    async stop() {
      const duration = (performance.now() - origin) / 1000;
      await client.send('Page.stopScreencast');
      try {
        await queue;
        if (failed) throw failed;
        await writeThrough(Math.ceil(duration * fps), previous.buffer);
        process.stdin.end();
        await completion;
        return { duration: frames / fps, frames, receivedFrames: received, fps, width, height };
      } finally {
        if (process.exitCode === null) process.kill();
        await client.detach();
      }
    },
  };
}
