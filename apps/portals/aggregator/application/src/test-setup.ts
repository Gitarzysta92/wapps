import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

// jsdom does not expose the browser structuredClone API yet.
import { deserialize, serialize } from 'node:v8';
if (!globalThis.structuredClone) {
  globalThis.structuredClone = value => deserialize(serialize(value));
}
