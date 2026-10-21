import type { DataSource } from 'typeorm';
import type {
  EditorialOutbox,
  EditorialOutboxItem,
} from '../application/editorial-outbox';

export class MysqlEditorialOutbox implements EditorialOutbox {
  constructor(private readonly source: DataSource) {}

  async status() {
    const [counts]: {
      pending: string | number;
      delivered: string | number;
      failed: string | number;
      oldestPendingAt: string | number | null;
    }[] = await this.source.query(`SELECT
      COUNT(CASE WHEN deliveredAt IS NULL AND failedAt IS NULL THEN 1 END) AS pending,
      COUNT(deliveredAt) AS delivered, COUNT(failedAt) AS failed,
      MIN(CASE WHEN deliveredAt IS NULL AND failedAt IS NULL THEN createdAt END) AS oldestPendingAt
      FROM editorial_outbox`);
    const failedRequests: {
      id: string;
      resourceKind: string;
      resourceId: string;
      revision: string;
      attempts: number;
    }[] = await this.source
      .query(`SELECT CAST(id AS CHAR) AS id, resourceKind, resourceId, CAST(revision AS CHAR) AS revision, attempts
        FROM editorial_outbox WHERE failedAt IS NOT NULL ORDER BY id LIMIT 100`);
    return { ...counts, failedRequests, failedRequestLimit: 100 };
  }

  async requeueFailed(id: string, now: number): Promise<boolean> {
    if (!/^[1-9][0-9]{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
      throw new Error('Expected a positive SQL outbox ID');
    const result: { affectedRows: number } = await this.source.query(
      `UPDATE editorial_outbox SET failedAt = NULL, attempts = 0, availableAt = ?, leaseToken = NULL,
       leasedUntil = NULL, lastError = NULL WHERE id = ? AND failedAt IS NOT NULL AND deliveredAt IS NULL
       AND (leasedUntil IS NULL OR leasedUntil < ?)`,
      [now, id, now]
    );
    return result.affectedRows === 1;
  }

  claim(now: number, token: string): Promise<EditorialOutboxItem | null> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const [row] = await manager.query<
        (Omit<EditorialOutboxItem, 'id'> & { id: string | number })[]
      >(
        `SELECT id, attempts, resourceKind AS kind, resourceId, tenantId, revision, createdAt FROM editorial_outbox
         WHERE deliveredAt IS NULL AND failedAt IS NULL AND availableAt <= ? AND (leasedUntil IS NULL OR leasedUntil < ?)
         ORDER BY availableAt, id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [now, now]
      );
      if (!row) return null;
      if (
        !Number.isSafeInteger(row.attempts) ||
        row.attempts < 0 ||
        (typeof row.id === 'number' && !Number.isSafeInteger(row.id)) ||
        !/^[1-9][0-9]*$/.test(String(row.id))
      )
        throw new Error('Invalid Editorial outbox storage identity');
      await manager.query(
        'UPDATE editorial_outbox SET leaseToken = ?, leasedUntil = ? WHERE id = ?',
        [token, now + 30_000, row.id]
      );
      return { ...row, id: String(row.id) };
    });
  }

  async delivered(id: string, token: string, at: number): Promise<boolean> {
    const result: { affectedRows: number } = await this.source.query(
      `UPDATE editorial_outbox SET deliveredAt = ?, leaseToken = NULL, leasedUntil = NULL, lastError = NULL
       WHERE id = ? AND leaseToken = ? AND deliveredAt IS NULL AND failedAt IS NULL`,
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
      `UPDATE editorial_outbox SET attempts = ?, availableAt = ?, failedAt = ?, leaseToken = NULL, leasedUntil = NULL,
       lastError = 'Publication or delivery marking failed; inspect and explicitly requeue'
       WHERE id = ? AND leaseToken = ? AND deliveredAt IS NULL AND failedAt IS NULL`,
      [attempts, availableAt, failedAt, id, token]
    );
  }
}
