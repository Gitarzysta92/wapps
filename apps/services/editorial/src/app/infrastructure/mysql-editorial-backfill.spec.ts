import type { DataSource, EntityManager } from 'typeorm';
import {
  EditorialLegacyBackfill,
  EditorialOwnershipManifest,
} from '../application/editorial-backfill';
import { editorialId } from '../../testing/editorial-projection-fixtures';
import { MysqlEditorialBackfill } from './mysql-editorial-backfill';

const manifest: EditorialOwnershipManifest = {
  version: 1,
  kind: 'tag',
  resourceId: editorialId(),
  tenantId: 'default',
  ownerIdentityId: 'verified-owner',
};

function fixture() {
  const data = {
    present: true,
    value: {
      name: 'Legacy tag',
      slug: 'legacy-tag',
      createdAtSql: '2026-01-01 01:02:03.456789',
      updatedAtSql: '2026-01-02 01:02:03.987654',
    },
    state: null as Record<string, unknown> | null,
    receipt: null as Record<string, unknown> | null,
    outbox: [] as unknown[][],
    commands: [] as unknown[],
  };
  const control = { failOn: '' };
  const query = jest.fn(
    async (sql: string, args: unknown[] = []): Promise<unknown[]> => {
      if (control.failOn && sql.startsWith(control.failOn))
        throw new Error('Injected write failure');
      if (sql.startsWith('SELECT id FROM tags'))
        return data.present ? [{ id: editorialId() }] : [];
      if (sql.startsWith('SELECT name'))
        return data.present ? [{ ...data.value }] : [];
      if (
        sql.startsWith('SELECT') &&
        sql.includes('FROM editorial_resource_states')
      )
        return data.state ? [data.state] : [];
      if (sql.startsWith('SELECT') && sql.includes('FROM editorial_backfills'))
        return data.receipt ? [data.receipt] : [];
      if (sql.startsWith('SELECT') && sql.includes('FROM editorial_outbox'))
        return data.outbox;
      if (sql.startsWith('SELECT') && sql.includes('FROM editorial_commands'))
        return data.commands;
      if (sql.startsWith('INSERT INTO editorial_resource_states'))
        data.state = {
          tenantId: args[2],
          ownerIdentityId: args[3],
          revision: 1,
          deletedAt: null,
        };
      else if (sql.startsWith('INSERT INTO editorial_outbox'))
        data.outbox.push(args);
      else if (sql.startsWith('INSERT INTO editorial_backfills'))
        data.receipt = {
          manifestFingerprint: args[2],
          sourceFingerprint: args[3],
          fingerprint: args[4],
          revision: 1,
        };
      else throw new Error(`Unexpected query: ${sql}`);
      return [];
    }
  );
  const outcomes: string[] = [];
  const transaction = jest.fn(
    async (
      _isolation: string,
      work: (manager: EntityManager) => Promise<unknown>
    ) => {
      const before = JSON.parse(JSON.stringify(data));
      try {
        const result = await work({ query } as unknown as EntityManager);
        outcomes.push('commit');
        return result;
      } catch (error) {
        Object.assign(data, before);
        outcomes.push('rollback');
        throw error;
      }
    }
  );
  const adapter = new MysqlEditorialBackfill(
    { transaction } as unknown as DataSource,
    'default',
    () => 100
  );
  return {
    data,
    control,
    query,
    transaction,
    outcomes,
    adapter,
    backfill: new EditorialLegacyBackfill(adapter),
  };
}

describe('Editorial legacy adoption transaction', () => {
  it('preserves exact values and timestamps while atomically adding ownership, revision, intent and receipt', async () => {
    const f = fixture();
    const original = { ...f.data.value };
    const plan = await f.backfill.plan(manifest);
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
    f.query.mockClear();
    expect(await f.adapter.commit(plan)).toMatchObject({
      fingerprint: plan.fingerprint,
      revision: 1,
    });
    expect(f.query.mock.calls[0][0]).toBe(
      'SELECT id FROM tags WHERE id = ? FOR UPDATE'
    );
    expect(f.data.value).toEqual(original);
    expect(f.data.state).toMatchObject({
      ownerIdentityId: 'verified-owner',
      tenantId: 'default',
      revision: 1,
      deletedAt: null,
    });
    expect(f.data.outbox).toHaveLength(1);
    expect(f.data.receipt).toMatchObject({
      fingerprint: plan.fingerprint,
      revision: 1,
    });
    expect(
      f.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT'))
    ).toHaveLength(3);
    expect(
      f.query.mock.calls.some(([sql]) => /^(UPDATE|DELETE)/.test(sql))
    ).toBe(false);
  });

  it.each(['INSERT INTO editorial_outbox', 'INSERT INTO editorial_backfills'])(
    'rolls back ownership and intent when %s fails',
    async (failOn) => {
      const f = fixture();
      const plan = await f.backfill.plan(manifest);
      f.control.failOn = failOn;
      await expect(f.adapter.commit(plan)).rejects.toThrow('Injected');
      expect(f.data.state).toBeNull();
      expect(f.data.outbox).toEqual([]);
      expect(f.data.receipt).toBeNull();
      expect(f.outcomes[f.outcomes.length - 1]).toBe('rollback');
    }
  );

  it('rejects drift between the external plan and the locked commit', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(manifest);
    f.data.value.name = 'Changed during review';
    await expect(f.adapter.commit(plan)).rejects.toThrow(
      'source changed before commit'
    );
    expect(f.data.state).toBeNull();
    expect(f.data.outbox).toEqual([]);
  });

  it('replays a committed plan without resetting subsequent edits or deletion', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(manifest);
    const receipt = await f.adapter.commit(plan);
    f.data.state = { ...f.data.state, revision: 4, deletedAt: 200 };
    f.data.value.name = 'An edited resource';
    f.query.mockClear();
    expect(await f.adapter.commit(plan)).toEqual(receipt);
    expect(f.data.state).toMatchObject({ revision: 4, deletedAt: 200 });
    expect(f.data.outbox).toHaveLength(1);
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });

  it('refuses mapping changes after commit even when a caller reuses the original plan fingerprint', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(manifest);
    await f.adapter.commit(plan);
    await expect(
      f.adapter.commit({
        ...plan,
        manifest: { ...manifest, ownerIdentityId: 'other' },
      })
    ).rejects.toThrow('ownership differs');
    expect(f.data.state?.ownerIdentityId).toBe('verified-owner');
  });

  it('cannot use ownership backfill to silently move a public legacy record to another tenant', async () => {
    const f = fixture();
    await expect(
      f.backfill.plan({ ...manifest, tenantId: 'private-tenant' })
    ).rejects.toThrow('preserve EDITORIAL_PUBLIC_TENANT');
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it.each(['versioned', 'outbox', 'command', 'orphan-receipt', 'missing'])(
    'rejects inconsistent legacy state: %s',
    async (condition) => {
      const f = fixture();
      if (condition === 'versioned') f.data.state = { revision: 1 };
      if (condition === 'outbox') f.data.outbox.push(['prior intent']);
      if (condition === 'command')
        f.data.commands.push({ resourceId: editorialId() });
      if (condition === 'orphan-receipt')
        f.data.receipt = { fingerprint: 'a'.repeat(64) };
      if (condition === 'missing') f.data.present = false;
      await expect(f.backfill.plan(manifest)).rejects.toThrow();
      expect(
        f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))
      ).toBe(true);
    }
  );
});
