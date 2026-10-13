import { createHash } from 'node:crypto';
import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  parseSuiteFields,
  suiteId,
  suiteObject,
  suiteRevision,
  SuiteInputError,
  SuiteUnavailableError,
  type PrivateSuite,
  type SuiteFields,
  type SuiteReceipt,
} from '@domains/publication/suite';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';

export interface SuiteCommand {
  actor: EditorialActor;
  key: string;
  fingerprint: string;
  type: 'create' | 'update' | 'delete';
  id: string;
  expectedRevision: number | null;
  fields: SuiteFields | null;
  at: number;
}
export interface SuiteWorkspaceStore {
  list(actor: EditorialActor): Promise<PrivateSuite[]>;
  read(actor: EditorialActor, id: string): Promise<PrivateSuite>;
  commit(command: SuiteCommand): Promise<SuiteReceipt>;
}

export class SuiteWorkspace {
  constructor(
    private readonly store: SuiteWorkspaceStore,
    private readonly policy: IPolicyEvaluator,
    private readonly ids: { generate(): string },
    private readonly now: () => number = Date.now
  ) {}

  async list(actor: EditorialActor) {
    await this.authorize(actor, 'read');
    return this.store.list(actor);
  }
  async read(actor: EditorialActor, id: string) {
    await this.authorize(actor, 'read');
    return this.store.read(actor, suiteId(id));
  }
  async change(
    actor: EditorialActor,
    type: SuiteCommand['type'],
    id: string | null,
    input: unknown,
    key: string
  ) {
    await this.authorize(actor, type);
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new SuiteInputError('A valid Idempotency-Key is required');
    const data = suiteObject(
      input,
      type === 'delete'
        ? ['expectedRevision']
        : type === 'create'
        ? ['title', 'description', 'applicationIds', 'classification']
        : [
            'title',
            'description',
            'applicationIds',
            'classification',
            'expectedRevision',
          ]
    );
    const expectedRevision =
      type === 'create' ? null : suiteRevision(data.expectedRevision);
    const fields =
      type === 'delete'
        ? null
        : parseSuiteFields({
            title: data.title,
            description: data.description,
            applicationIds: data.applicationIds,
            classification: data.classification,
          });
    const target = type === 'create' ? null : suiteId(id);
    return this.store.commit({
      actor,
      key,
      type,
      fields,
      expectedRevision,
      id: target ?? suiteId(this.ids.generate()),
      at: this.now(),
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ type, id: target, fields, expectedRevision }))
        .digest('hex'),
    });
  }

  private async authorize(
    actor: EditorialActor,
    operation: 'read' | SuiteCommand['type']
  ) {
    assertEditorialActor(actor);
    let decision;
    try {
      decision = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: this.now(),
        actionName: `editorial.suite.${operation}`,
        subject: { roles: actor.roles },
        resource: {
          type: 'suite-workspace',
          id: actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new SuiteUnavailableError('Suite authorization is unavailable');
    }
    if (!decision.ok)
      throw new SuiteUnavailableError('Suite authorization is unavailable');
    if (decision.value !== true)
      throw new PermissionDeniedError(`editorial.suite.${operation}`);
  }
}
