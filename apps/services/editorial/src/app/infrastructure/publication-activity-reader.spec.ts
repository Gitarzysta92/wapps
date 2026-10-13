import { CatalogPublicationActivityReader } from './publication-activity-reader';
import type { PublicationActivityCandidate } from '../application/profile-activity';

const id = '00000000-0000-4000-8000-000000000001';
const candidate: PublicationActivityCandidate = {
  kind: 'release',
  id,
  at: 100,
  revision: 3,
  slug: null,
  applicationSlug: 'public-app',
  version: 'v'.repeat(80),
};
function fixture() {
  const applications = { find: jest.fn() },
    suites = { find: jest.fn() },
    articles = { find: jest.fn() };
  const releases = {
    find: jest.fn().mockResolvedValue({
      id,
      revision: 3,
      title: 'Published release title',
      applicationName: 'A'.repeat(255),
      applicationSlug: 'public-app',
      version: candidate.version,
    }),
  };
  return {
    applications,
    suites,
    articles,
    releases,
    reader: new CatalogPublicationActivityReader(
      applications,
      suites,
      articles,
      releases
    ),
  };
}
describe('current public publication activity adapter', () => {
  it('uses the supplied release title even with maximum-length parent names and versions', async () => {
    const f = fixture();
    expect(await f.reader.read(candidate)).toEqual({
      revision: 3,
      activity: {
        kind: 'release',
        id,
        at: 100,
        title: 'Published release title',
        target: {
          kind: 'release',
          id,
          applicationSlug: 'public-app',
          version: candidate.version,
        },
      },
    });
    expect(f.releases.find).toHaveBeenCalledWith(
      'public-app',
      candidate.version
    );
  });
  it('refuses a different public record or an unavailable exact revision', async () => {
    const f = fixture();
    f.releases.find.mockResolvedValueOnce({ id: 'another-release' });
    await expect(f.reader.read(candidate)).rejects.toThrow('changed');
    f.releases.find.mockRejectedValueOnce(new Error('Projection pending'));
    await expect(f.reader.read(candidate)).rejects.toThrow(
      'Projection pending'
    );
  });
});
