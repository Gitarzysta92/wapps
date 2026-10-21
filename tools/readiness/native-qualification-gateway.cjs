const path = require('node:path');
const {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
} = require('node:fs');
const { processService } = require('./qualification-process.cjs');

// Optional native Nginx uses the same includes; only test filesystem/network addresses change.
async function nativeQualificationGateway({
  binary,
  directory,
  freePort,
  execute,
}) {
  if (!path.isAbsolute(binary))
    throw new Error('WAPPS_NGINX_BINARY must be absolute');
  const ports = { local: await freePort(), alpha: await freePort() };
  mkdirSync(path.join(directory, 'logs'));
  for (const file of readdirSync(directory).filter((name) =>
    name.endsWith('.conf')
  )) {
    const target = path.join(directory, file);
    writeFileSync(
      target,
      readFileSync(target, 'utf8')
        .replaceAll('/etc/nginx/qualification/', directory + '/')
        .replaceAll('host.docker.internal', '127.0.0.1')
        .replaceAll('listen 8080;', `listen 127.0.0.1:${ports.local};`)
        .replaceAll('listen 8081;', `listen 127.0.0.1:${ports.alpha};`)
        .replaceAll(
          'access_log /dev/stdout qualification;',
          'access_log logs/access.log qualification;'
        )
    );
  }
  const args = [
    '-p',
    directory + '/',
    '-c',
    path.join(directory, 'nginx.conf'),
    '-e',
    path.join(directory, 'logs/error.log'),
    '-g',
    'daemon off;',
  ];
  await execute(binary, [...args, '-t'], { timeout: 5000 });
  const service = await processService(
    binary,
    args,
    { cwd: directory },
    () => `http://127.0.0.1:${ports.local}`,
    '/health'
  );
  return {
    ...service,
    ports,
    diagnostics: () =>
      ['error', 'access']
        .map((name) =>
          readFileSync(path.join(directory, `logs/${name}.log`), 'utf8')
            .split('\n')
            .slice(-16)
            .join('\n')
        )
        .join('\n'),
  };
}

module.exports = { nativeQualificationGateway };
