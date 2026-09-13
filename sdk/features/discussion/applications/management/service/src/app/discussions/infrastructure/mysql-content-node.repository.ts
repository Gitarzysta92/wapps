import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IContentNode, IContentNodeRelation, IContentNodeRepository } from '@sdk/kernel/ontology/content';
import { err, ok, Result, Uuidv7 } from '@sdk/kernel/standard';
import { Repository } from 'typeorm';
import { ContentNodeEntity } from './content-node.entity';
import { ContentNodeRelationEntity } from './content-node-relation.entity';

@Injectable()
export class MysqlContentNodeRepository implements IContentNodeRepository {
  constructor(
    @InjectRepository(ContentNodeEntity)
    private readonly nodes: Repository<ContentNodeEntity>,
    @InjectRepository(ContentNodeRelationEntity)
    private readonly relations: Repository<ContentNodeRelationEntity>
  ) {}

  async addNode(c: IContentNode, rels: IContentNodeRelation[] = []): Promise<Result<boolean, Error>> {
    try {
      await this.nodes.manager.transaction(async (tx) => {
        await tx.getRepository(ContentNodeEntity).insert({
          id: c.id,
          referenceKey: c.referenceKey,
          kind: c.kind,
          state: c.state,
          visibility: c.visibility,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          deletedAt: c.deletedAt,
        });

        if (rels.length > 0) {
          await tx.getRepository(ContentNodeRelationEntity).insert(
            rels.map((r) => ({
              id: r.id,
              fromContentId: r.fromContentId,
              toContentId: r.toContentId,
              relationType: r.relationType,
              createdAt: r.createdAt,
            }))
          );
        }
      });

      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async updateNode(c: IContentNode, rels: IContentNodeRelation[]): Promise<Result<boolean, Error>> {
    try {
      await this.nodes.manager.transaction(async (tx) => {
        await tx.getRepository(ContentNodeEntity).update(
          { id: c.id },
          {
            referenceKey: c.referenceKey,
            kind: c.kind,
            state: c.state,
            visibility: c.visibility,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            deletedAt: c.deletedAt,
          }
        );

        // Replace relations for the node (simple + deterministic)
        await tx.getRepository(ContentNodeRelationEntity).delete({ fromContentId: c.id });
        if (rels.length > 0) {
          await tx.getRepository(ContentNodeRelationEntity).insert(
            rels.map((r) => ({
              id: r.id,
              fromContentId: r.fromContentId,
              toContentId: r.toContentId,
              relationType: r.relationType,
              createdAt: r.createdAt,
            }))
          );
        }
      });

      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteNode(c: IContentNode): Promise<Result<boolean, Error>> {
    try {
      await this.nodes.manager.transaction(async (tx) => {
        await tx.getRepository(ContentNodeRelationEntity).delete({ fromContentId: c.id });
        await tx.getRepository(ContentNodeEntity).delete({ id: c.id });
      });
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getNode<T extends IContentNode>(id: Uuidv7): Promise<Result<T, Error>> {
    try {
      const node = await this.nodes.findOne({ where: { id } });
      if (!node) {
        return err(new Error(`Content node not found: ${id}`));
      }
      return ok(node as unknown as T);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getNodesByKind<T extends IContentNode>(kind: string): Promise<Result<T[], Error>> {
    try {
      const nodes = await this.nodes.find({ where: { kind } });
      return ok(nodes as unknown as T[]);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getNodesByState<T>(state: any): Promise<Result<T[], Error>> {
    try {
      const nodes = await this.nodes.find({ where: { state } });
      return ok(nodes as unknown as T[]);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getNodesByVisibility<T extends IContentNode>(visibility: any): Promise<Result<T[], Error>> {
    try {
      const nodes = await this.nodes.find({ where: { visibility } });
      return ok(nodes as unknown as T[]);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

