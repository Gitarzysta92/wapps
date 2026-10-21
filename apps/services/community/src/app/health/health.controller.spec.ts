import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok status payload', () => {
    const controller = new HealthController();
    const res = controller.check();

    expect(res).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'discussion',
      })
    );
    expect(typeof res.timestamp).toBe('string');
  });
});

