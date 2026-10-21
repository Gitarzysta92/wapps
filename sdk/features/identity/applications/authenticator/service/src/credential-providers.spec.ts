import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { MysqlLocalCredentials } from '@sdk/extras/identity-local';
import { createCredentialAdapters } from './credential-providers';

describe('credential provider composition', () => {
  it('composes local authentication without initializing or contacting Firebase', async () => {
    const adapters = createCredentialAdapters(
      new ConfigService({ AUTH_PROVIDER: 'local' }),
      {} as DataSource
    );
    expect(adapters.sessions).toBeInstanceOf(MysqlLocalCredentials);
    expect(adapters.verifier).toBe(adapters.sessions);
    expect(adapters.revoker).toBe(adapters.sessions);
    expect(
      (await adapters.google.create('code', 'redirect', 'verifier').execute())
        .ok
    ).toBe(false);
    expect(
      (await adapters.github.create('code', 'redirect').execute()).ok
    ).toBe(false);
    expect((await adapters.anonymous.create().execute()).ok).toBe(false);
  });
  it('does not fall back to local mode when Firebase configuration is missing', () => {
    expect(() =>
      createCredentialAdapters(new ConfigService(), {} as DataSource)
    ).toThrow('FIREBASE_WEB_API_KEY');
  });
});
