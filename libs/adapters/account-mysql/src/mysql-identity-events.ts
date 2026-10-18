import type { DataSource } from 'typeorm';
import type {
  IdentityEventOutbox,
  IdentityEventWork,
} from '@sdk/features/identity/libs/authentication';

export class MysqlIdentityEvents implements IdentityEventOutbox {
  constructor(private readonly source: DataSource) {}

  claim(at: number, token: string): Promise<IdentityEventWork | null> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const [row] = await manager.query<
        (Omit<IdentityEventWork, 'revision'> & { revision: number | string })[]
      >(
        `SELECT id, identityId, revision, eventType, body, attempts FROM identity_events_outbox WHERE deliveredAt IS NULL AND failedAt IS NULL AND availableAt <= ? AND (leasedUntil IS NULL OR leasedUntil < ?) ORDER BY availableAt, id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [at, at]
      );
      if (!row) return null;
      await manager.query(
        'UPDATE identity_events_outbox SET leaseToken = ?, leasedUntil = ? WHERE id = ?',
        [token, at + 30_000, row.id]
      );
      return { ...row, revision: Number(row.revision) };
    });
  }

  async delivered(id: string, token: string, at: number): Promise<boolean> {
    const result: { affectedRows: number } = await this.source.query(
      'UPDATE identity_events_outbox SET deliveredAt = ?, leaseToken = NULL, leasedUntil = NULL WHERE id = ? AND leaseToken = ? AND deliveredAt IS NULL AND failedAt IS NULL',
      [at, id, token]
    );
    return result.affectedRows === 1;
  }

  async failed(
    id: string,
    token: string,
    attempts: number,
    availableAt: number,
    failedAt: number | null
  ): Promise<void> {
    await this.source.query(
      'UPDATE identity_events_outbox SET attempts = ?, availableAt = ?, failedAt = ?, leaseToken = NULL, leasedUntil = NULL WHERE id = ? AND leaseToken = ? AND deliveredAt IS NULL AND failedAt IS NULL',
      [attempts, availableAt, failedAt, id, token]
    );
  }
}
