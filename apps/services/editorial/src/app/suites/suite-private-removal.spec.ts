import { DataSource } from 'typeorm';
import { MysqlSuitePublication } from './mysql-suite-publication';

const id = '019a0010-0000-7000-8000-000000000001';
const owner = { identityId: 'Alice', tenantId: 'default', roles: [] };

describe('publication status after private suite removal', () => {
  function fixture(published = true, withdrawn = false) {
    const source = new DataSource({ type: 'mysql', database: 'unused' });
    const query = jest
      .spyOn(source.manager, 'query')
      .mockImplementation(async (sql: string, args?: unknown[]) => {
        if (sql.includes('FROM private_suites')) {
          if (
            args?.[1] !== owner.tenantId ||
            (args.length === 3 && args[2] !== owner.identityId)
          )
            return [];
          return [
            {
              id,
              tenantId: owner.tenantId,
              ownerIdentityId: owner.identityId,
              revision: 8,
              deletedAt: 30,
            },
          ];
        }
        if (sql.includes('FROM suite_submissions')) return [];
        if (sql.includes('FROM editorial_resource_states'))
          return published || withdrawn
            ? [
                {
                  tenantId: owner.tenantId,
                  ownerIdentityId: owner.identityId,
                  revision: 2,
                  deletedAt: withdrawn ? 40 : null,
                },
              ]
            : [];
        if (sql.includes('FROM suite_publications'))
          return published ? [{ submittedRevision: 2 }] : [];
        throw new Error('Unexpected SQL');
      });
    jest
      .spyOn(source, 'transaction')
      .mockImplementation(async (isolationOrWork, run) => {
        const work =
          typeof isolationOrWork === 'function' ? isolationOrWork : run;
        if (!work) throw new Error('Transaction callback required');
        return work(source.manager);
      });
    return { store: new MysqlSuitePublication(source, 'default'), query };
  }

  it.each([false, true])(
    'keeps owner publication management available after removal (withdrawn=%s)',
    async (withdrawn) => {
      const { store } = fixture(true, withdrawn);
      await expect(store.read(owner, id, false)).resolves.toEqual({
        id,
        revision: 8,
        publicationRevision: 2,
        publishedSubmissionRevision: withdrawn ? null : 2,
        latestSubmission: null,
      });
    }
  );

  it('does not expose removed drafts that never had a publication', async () => {
    await expect(fixture(false).store.read(owner, id, false)).rejects.toThrow(
      'Suite not found'
    );
  });

  it('preserves historical deletion when the old lifecycle removed the public snapshot', async () => {
    await expect(
      fixture(false, true).store.read(owner, id, false)
    ).rejects.toThrow('Suite not found');
  });

  it('does not expose removed private review history to an independent reviewer', async () => {
    await expect(
      fixture().store.read(
        { ...owner, identityId: 'Reviewer', roles: ['editorial:reviewer'] },
        id,
        true
      )
    ).rejects.toThrow('Suite not found');
  });

  it.each([
    { ...owner, identityId: 'Bob' },
    { ...owner, tenantId: 'foreign' },
  ])(
    'retains exact owner/tenant isolation for publication management',
    async (actor) => {
      await expect(fixture().store.read(actor, id, false)).rejects.toThrow(
        'Suite not found'
      );
    }
  );
});
