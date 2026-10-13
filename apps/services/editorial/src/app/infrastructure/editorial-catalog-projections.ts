import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformMongoClient } from '@sdk/extras/mongo';
import type {
  EditorialProjection,
  EditorialProjectionKind,
} from '@apps/shared';
import type { EditorialProjectionStore } from '../application/editorial-materialization';
import {
  MongoEditorialProjections,
  EDITORIAL_PROJECTION_COLLECTION,
} from './mongo-editorial-projections';

@Injectable()
export class EditorialCatalogProjections
  implements OnModuleDestroy, EditorialProjectionStore
{
  private readonly mongo = new PlatformMongoClient();
  private connection?: Promise<MongoEditorialProjections>;
  private stopped = false;

  constructor(private readonly config: ConfigService) {}

  async find(
    kind: EditorialProjectionKind,
    id: string
  ): Promise<unknown | null> {
    return (await this.store()).find(kind, id);
  }

  async publish(projection: EditorialProjection) {
    return (await this.store()).publish(projection);
  }

  private async store(): Promise<MongoEditorialProjections> {
    if (this.stopped) throw new Error('Catalog projection reader is stopped');
    // Share connection attempts; a projection outage must not stop authoritative command handling.
    this.connection ??= this.connect().catch(async (error: unknown) => {
      await this.mongo.close();
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.connection?.catch(() => undefined);
    await this.mongo.close();
  }

  private async connect(): Promise<MongoEditorialProjections> {
    const required = (name: string): string => {
      const value = this.config.get<string>(name);
      if (!value) throw new Error(`Missing ${name}`);
      return value;
    };
    await this.mongo.connect({
      host: required('MONGO_HOST'),
      port: required('MONGO_PORT'),
      username: required('MONGO_USERNAME'),
      password: required('MONGO_PASSWORD'),
      database: required('MONGO_DATABASE'),
      options: {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        socketTimeoutMS: 5000,
        maxPoolSize: 20,
        waitQueueTimeoutMS: 3000,
      },
    });
    return new MongoEditorialProjections(
      this.mongo.collection<EditorialProjection>(
        EDITORIAL_PROJECTION_COLLECTION
      )
    );
  }
}
