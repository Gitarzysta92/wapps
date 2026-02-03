import type { Collection, Db, Document, MongoClientOptions } from 'mongodb';
import { MongoClient } from 'mongodb';

export interface MongoConnectConfig {
  uri: string;
  dbName?: string;
  options?: MongoClientOptions;
}

export interface MongoConnectParams {
  host: string;
  port?: string | number;
  username?: string;
  password?: string;
  /**
   * Database to use as default (maps to `dbName` in the URI form).
   * If omitted, the driver's default DB from the URI (or `admin`) will be used.
   */
  database?: string;
  options?: MongoClientOptions;
}

function buildMongoUri(params: MongoConnectParams): string {
  const host = params.host?.trim();
  if (!host) throw new Error('MONGO_HOST is required');

  const port =
    params.port === undefined || params.port === null || `${params.port}`.trim() === ''
      ? ''
      : `:${encodeURIComponent(`${params.port}`.trim())}`;

  const hasAuth = !!(params.username && params.password);
  const auth = hasAuth
    ? `${encodeURIComponent(params.username!.trim())}:${encodeURIComponent(params.password!.trim())}@`
    : '';

  // Keep it simple (no replica sets / SRV). Caller can still use `uri` form for advanced cases.
  return `mongodb://${auth}${host}${port}`;
}

/**
 * Minimal wrapper around the official MongoDB driver.
 *
 * This intentionally keeps the surface small; domain-specific repositories
 * should live in the service/domain layer and use this for connectivity.
 */
export class PlatformMongoClient {
  private client: MongoClient | null = null;
  private defaultDb: Db | null = null;

  async connect(cfg: MongoConnectConfig): Promise<Db>;
  async connect(cfg: MongoConnectParams): Promise<Db>;
  async connect(cfg: MongoConnectConfig | MongoConnectParams): Promise<Db> {
    const uri = 'uri' in cfg ? cfg.uri : buildMongoUri(cfg);
    const dbName = 'uri' in cfg ? cfg.dbName : cfg.database;
    const options = cfg.options;

    if (!uri) throw new Error('Mongo connection URI is required');
    this.client = new MongoClient(uri, options);
    await this.client.connect();

    this.defaultDb = dbName ? this.client.db(dbName) : null;
    return this.db(dbName);
  }

  db(dbName?: string): Db {
    if (!this.client) {
      throw new Error('Mongo client is not initialized. Did you call connect()?');
    }
    if (dbName) return this.client.db(dbName);
    if (this.defaultDb) return this.defaultDb;
    // fall back to the driver's default DB from the URI
    return this.client.db();
  }

  collection<T extends Document = Document>(name: string, dbName?: string): Collection<T> {
    return this.db(dbName).collection<T>(name);
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.close();
    this.client = null;
    this.defaultDb = null;
  }
}
