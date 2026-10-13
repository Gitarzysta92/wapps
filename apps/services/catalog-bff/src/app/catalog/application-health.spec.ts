import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosHeaders, type AxiosResponse } from 'axios';
import {
  HealthNotFoundError,
  HealthUnavailableError,
} from '@domains/reliability';
import { ApplicationHealthClient } from './application-health.client';
const report = {
  application: {
    id: '10000000-0000-4000-8000-000000000001',
    slug: 'example',
    name: 'Example',
  },
  asOf: Date.UTC(2026, 9, 13),
  monitors: [],
};
const response = (data: unknown): AxiosResponse<unknown> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});
function setup(origin: string | undefined = 'http://editorial:3000') {
  const http = new HttpService(),
    config = new ConfigService({ EDITORIAL_URL: origin });
  jest.spyOn(config, 'get').mockReturnValue(origin);
  const get = jest.spyOn(http, 'get').mockReturnValue(of(response(report)));
  return { get, client: new ApplicationHealthClient(http, config) };
}
describe('Health BFF contract', () => {
  it('uses bounded requests and validates the owning service report', async () => {
    const f = setup();
    expect(await f.client.read('example', {})).toEqual(report);
    expect(f.get).toHaveBeenCalledWith(
      'http://editorial:3000/api/catalog/application-health/example',
      expect.objectContaining({
        maxRedirects: 0,
        timeout: 15000,
        maxContentLength: 256 * 1024,
      })
    );
  });
  it('distinguishes an absent application from an unavailable source', async () => {
    const f = setup();
    f.get.mockReturnValue(
      throwError(() => ({ isAxiosError: true, response: { status: 404 } }))
    );
    await expect(f.client.read('example', {})).rejects.toBeInstanceOf(
      HealthNotFoundError
    );
    f.get.mockReturnValue(
      throwError(() => ({ isAxiosError: true, response: { status: 503 } }))
    );
    await expect(f.client.read('example', {})).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
  });
  it('rejects malformed, wrong-application and unexpected query responses', async () => {
    const f = setup();
    await expect(f.client.read('other', {})).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
    f.get.mockReturnValue(of(response({ ...report, monitors: [{}] })));
    await expect(f.client.read('example', {})).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
    f.get.mockClear();
    await expect(
      f.client.read('example', { tenantId: 'private' })
    ).rejects.toThrow();
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([
    '',
    'file:///tmp/health',
    'http://user:pass@editorial/',
    'http://editorial/path',
  ])('does not call an invalid origin %s', async (origin) => {
    const f = setup(origin);
    await expect(f.client.read('example', {})).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
    expect(f.get).not.toHaveBeenCalled();
  });
});
