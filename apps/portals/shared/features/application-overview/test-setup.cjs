const { setupZoneTestEnv } = require('jest-preset-angular/setup-env/zone');
setupZoneTestEnv();
// jsdom does not expose structuredClone or crypto.randomUUID.
global.structuredClone = value => require('v8').deserialize(require('v8').serialize(value));
Object.defineProperty(global.crypto, 'randomUUID', { value: () => require('crypto').randomUUID() });
