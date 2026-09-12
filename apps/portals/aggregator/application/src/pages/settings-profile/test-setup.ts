import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import { serialize, deserialize } from 'node:v8';
setupZoneTestEnv();
if (!globalThis.structuredClone) {
  globalThis.structuredClone = value => deserialize(serialize(value));
}
