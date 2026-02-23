import type { Pool, PoolConnection, PoolOptions } from 'mysql2/promise';
import { createPool } from 'mysql2/promise';

export type MysqlConnectConfig = PoolOptions & {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/**
 * Minimal mysql2/promise wrapper to centralize pool lifecycle and provide
 * a reusable transaction helper.
 */
export class MysqlClient {
  private pool: Pool | null = null;

  connect(cfg: MysqlConnectConfig): Pool {
    this.pool = createPool({
      waitForConnections: true,
      connectionLimit: 10,
      ...cfg,
    });
    return this.pool;
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('MySQL pool is not initialized. Did you call connect()?');
    }
    return this.pool;
  }

  async withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const pool = this.getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        // ignore rollback failures; rethrow original error
      }
      throw error;
    } finally {
      conn.release();
    }
  }

  async close(): Promise<void> {
    if (!this.pool) return;
    await this.pool.end();
    this.pool = null;
  }
}
