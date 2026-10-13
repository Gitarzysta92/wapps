import {
  HealthNotFoundError,
  HealthUnavailableError,
} from '@domains/reliability';
import { PublicApplicationHealth } from './public-application-health';
const app = {
  id: '10000000-0000-4000-8000-000000000001',
  slug: 'example',
  name: 'Example',
  revision: 1,
};
const report = { asOf: Date.UTC(2026, 9, 13), monitors: [] };
describe('Current public application health', () => {
  it('confirms current public identity before and after reading health', async () => {
    const catalog = { find: jest.fn().mockResolvedValue(app) },
      health = { read: jest.fn().mockResolvedValue(report) };
    expect(
      await new PublicApplicationHealth(catalog, health).read('example', {})
    ).toEqual({
      ...report,
      application: { id: app.id, slug: app.slug, name: app.name },
    });
    expect(catalog.find).toHaveBeenCalledTimes(2);
    expect(health.read).toHaveBeenCalledWith(app.id);
  });
  it('hides missing and withdrawn parents, including withdrawal during the read', async () => {
    const catalog = { find: jest.fn().mockResolvedValue(null) },
      health = { read: jest.fn().mockResolvedValue(report) };
    const reader = new PublicApplicationHealth(catalog, health);
    await expect(reader.read('example', {})).rejects.toBeInstanceOf(
      HealthNotFoundError
    );
    expect(health.read).not.toHaveBeenCalled();
    catalog.find.mockResolvedValueOnce(app);
    await expect(reader.read('example', {})).rejects.toBeInstanceOf(
      HealthNotFoundError
    );
  });
  it('fails closed on changed parents, broken evidence and source outages', async () => {
    const catalog = { find: jest.fn().mockResolvedValue(app) },
      health = { read: jest.fn().mockResolvedValue(report) };
    const reader = new PublicApplicationHealth(catalog, health);
    catalog.find
      .mockResolvedValueOnce(app)
      .mockResolvedValueOnce({ ...app, revision: 2 });
    await expect(reader.read('example', {})).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
    health.read.mockResolvedValue({ ...report, monitors: [{}] });
    await expect(reader.read('example', {})).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
    catalog.find.mockRejectedValue(new Error());
    await expect(reader.read('example', {})).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
  });
  it('rejects scope injection before reading', async () => {
    const catalog = { find: jest.fn() },
      health = { read: jest.fn() };
    await expect(
      new PublicApplicationHealth(catalog, health).read('example', {
        tenantId: 'private',
      })
    ).rejects.toThrow();
    expect(catalog.find).not.toHaveBeenCalled();
  });
});
