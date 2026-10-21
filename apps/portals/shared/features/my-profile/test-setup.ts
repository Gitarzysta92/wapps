import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
setupZoneTestEnv();

import { randomUUID } from 'node:crypto';
Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID, configurable: true });
