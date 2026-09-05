import { ok } from '@foundation/standard';
import { IdentityAuthenticationService } from './identity-authentication.service';

describe('Bearer authorization parsing', () => {
  const verifyIdToken = jest.fn();
  const service = new IdentityAuthenticationService(
    { verifyIdToken }, {} as never, {} as never, {} as never,
    { enabledEmailPassword: true, enabledGoogle: false, enabledGithub: false, enabledAnonymous: false }
  );

  beforeEach(() => {
    verifyIdToken.mockReset().mockResolvedValue(ok({ uid: 'local-user' }));
  });

  it.each(['Bearer signed-token', 'bearer signed-token', 'BEARER\tsigned-token'])(
    'validates the token in %j', async (header) => {
      const result = await service.validateRequired(header);
      expect(result.ok).toBe(true);
      expect(verifyIdToken).toHaveBeenCalledWith('signed-token');
    }
  );

  it.each([undefined, '', 'Basic signed-token', 'signed-token', 'Bearer ', 'Bearer\\ssigned-token'])(
    'rejects malformed header %j without validating a token', async (header) => {
      expect((await service.validateRequired(header)).ok).toBe(false);
      expect(verifyIdToken).not.toHaveBeenCalled();
    }
  );
});
