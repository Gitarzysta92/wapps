const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

async function processService(command, args, options, resolveOrigin, health) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  let spawnError;
  child.on('error', (error) => {
    spawnError = error;
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (data) => {
      diagnostic = (diagnostic + data).slice(-8000);
    });
  async function stop(signal = 'SIGTERM') {
    if (child.exitCode !== null || child.signalCode !== null || spawnError)
      return;
    const exited = once(child, 'exit');
    child.kill(signal);
    const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(deadline);
    }
  }
  try {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (spawnError || child.exitCode !== null || child.signalCode !== null)
        throw new Error(`Qualification process exited: ${diagnostic}`);
      const origin = resolveOrigin(diagnostic);
      if (origin) {
        try {
          const response = await fetch(`${origin}${health}`, {
            signal: AbortSignal.timeout(500),
          });
          await response.arrayBuffer();
          if (response.ok)
            return { origin, stop, crash: () => stop('SIGKILL') };
        } catch {
          /* Bound the startup wait; listening is not readiness evidence. */
        }
      }
      await delay(100);
    }
    throw new Error(`Qualification process startup timed out: ${diagnostic}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

module.exports = { processService };
