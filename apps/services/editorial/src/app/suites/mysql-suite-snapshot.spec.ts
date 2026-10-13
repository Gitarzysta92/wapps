import type { EntityManager } from 'typeorm';
import { readSuitePublicationSnapshot } from './mysql-suite-snapshot';

const id = '10000000-0000-4000-8000-000000000001';
const applicationId = '10000000-0000-4000-8000-000000000002';
function fixture() {
  const state = {
    tenantId: 'default',
    ownerIdentityId: 'Owner',
    revision: 8,
    deletedAt: null as number | null,
  };
  const publication: Record<string, unknown> = {
    suiteId: id,
    submittedRevision: 3,
    publishedAt: 10,
    title: 'Approved title',
    description: 'Reviewed content',
    applicationIds: JSON.stringify([applicationId]),
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('editorial_resource_states')) return [state];
    if (sql.includes('suite_publications')) return [publication];
    throw new Error('Public snapshot must not depend on private history');
  });
  return {
    state,
    publication,
    query,
    manager: { query } as unknown as EntityManager,
  };
}

describe('canonical suite publication snapshot', () => {
  it('uses the frozen approved content without reading private drafts or submissions', async () => {
    const f = fixture();
    await expect(readSuitePublicationSnapshot(f.manager, id)).resolves.toEqual({
      kind: 'suite',
      resourceId: id,
      tenantId: 'default',
      revision: 8,
      deletedAt: null,
      content: {
        title: 'Approved title',
        description: 'Reviewed content',
        applicationIds: [applicationId],
        submittedRevision: 3,
        publishedAt: 10,
      },
    });
  });
  it('returns a tombstone without requiring a retained publication body', async () => {
    const f = fixture();
    f.state.deletedAt = 20;
    await expect(
      readSuitePublicationSnapshot(f.manager, id)
    ).resolves.toMatchObject({ deletedAt: 20, content: null });
    expect(f.query).toHaveBeenCalledTimes(1);
  });
  it.each([null, -1, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid publication time %s',
    async (time) => {
      const f = fixture();
      f.publication.publishedAt = time;
      await expect(readSuitePublicationSnapshot(f.manager, id)).rejects.toThrow(
        'publication time'
      );
    }
  );
  it('refuses corrupt stored members instead of inventing an empty public collection', async () => {
    const f = fixture();
    f.publication.applicationIds = [];
    await expect(readSuitePublicationSnapshot(f.manager, id)).rejects.toThrow(
      'publication content'
    );
  });
});
