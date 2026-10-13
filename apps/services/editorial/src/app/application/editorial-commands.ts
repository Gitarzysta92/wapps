import { createHash } from 'node:crypto';
import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import { parseEditorialInput, resourceId } from './editorial-input';
import {
  EditorialActor,
  EditorialCommandIdentity,
  EditorialConflictError,
  EditorialMutation,
  EditorialNotFoundError,
  EditorialResourceKind,
  EditorialResourceState,
  EditorialUnavailableError,
  EditorialValidationError,
  EditorialWrites,
} from './editorial.ports';

export function assertEditorialActor(actor: EditorialActor): void {
  if (
    !actor ||
    ![actor.identityId, actor.tenantId].every(
      (value) =>
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 128 &&
        value.trim() === value &&
        [...value].every(
          (character) =>
            character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
        )
    ) ||
    !Array.isArray(actor.roles) ||
    actor.roles.length > 64 ||
    !actor.roles.every(
      (role) =>
        typeof role === 'string' && role.length > 0 && role.length <= 128
    )
  )
    throw new PermissionDeniedError('editorial.mutate');
}

export function assertEditorialOwnership(
  actor: EditorialActor,
  state: EditorialResourceState
): void {
  const privileged =
    actor.roles.includes('admin') ||
    (state.kind === 'app'
      ? actor.roles.includes('editorial:moderator')
      : actor.roles.includes('editorial:taxonomy'));
  if (
    actor.tenantId !== state.tenantId ||
    (actor.identityId !== state.ownerIdentityId && !privileged)
  )
    throw new PermissionDeniedError(`editorial.${state.kind}.mutate`);
}

export class EditorialCommands {
  constructor(
    private readonly writes: EditorialWrites,
    private readonly policy: IPolicyEvaluator,
    private readonly ids: { generate(): string },
    private readonly now: () => number = Date.now
  ) {}

  create(
    kind: EditorialResourceKind,
    input: unknown,
    actor: EditorialActor,
    key: string
  ) {
    return this.execute(kind, 'create', null, input, actor, key);
  }

  update(
    kind: EditorialResourceKind,
    id: string,
    input: unknown,
    actor: EditorialActor,
    key: string
  ) {
    return this.execute(kind, 'update', resourceId(id), input, actor, key);
  }

  remove(
    kind: EditorialResourceKind,
    id: string,
    input: unknown,
    actor: EditorialActor,
    key: string
  ) {
    return this.execute(kind, 'delete', resourceId(id), input, actor, key);
  }

  private async execute(
    kind: EditorialResourceKind,
    type: EditorialMutation['type'],
    id: string | null,
    input: unknown,
    actor: EditorialActor,
    key: string
  ) {
    assertEditorialActor(actor);
    if (!['app', 'category', 'tag'].includes(kind))
      throw new EditorialValidationError('Unknown resource kind');
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new EditorialValidationError('A valid Idempotency-Key is required');
    const { fields, expectedRevision } = parseEditorialInput(kind, type, input);
    const command: EditorialCommandIdentity = {
      actor,
      key,
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ kind, type, id, fields, expectedRevision }))
        .digest('hex'),
    };
    const previous = id ? await this.writes.resource(kind, id) : null;
    // Legacy rows do not acquire an owner merely because an administrator edits them.
    if (id && !previous)
      throw new PermissionDeniedError('editorial.verified-ownership-required');
    if (previous) assertEditorialOwnership(actor, previous);
    const actionName = `editorial.${kind}.${type}`;
    let decision;
    try {
      decision = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: this.now(),
        actionName,
        subject: { roles: actor.roles },
        resource: {
          type: kind,
          id: id ?? undefined,
          tenantId: previous?.tenantId ?? actor.tenantId,
          attributes: {
            ownerIdentityId: previous
              ? previous.ownerIdentityId
              : actor.identityId,
            revision: previous?.revision ?? 0,
          },
        },
      });
    } catch {
      throw new EditorialUnavailableError(
        'Editorial authorization is unavailable'
      );
    }
    if (!decision.ok)
      throw new EditorialUnavailableError(
        'Editorial authorization is unavailable'
      );
    if (decision.value !== true) throw new PermissionDeniedError(actionName);
    const receipt = await this.writes.receipt(command);
    if (receipt) return receipt;
    if (previous?.deletedAt !== null && previous)
      throw new EditorialNotFoundError('Resource was deleted');
    if (previous && previous.revision !== expectedRevision)
      throw new EditorialConflictError('Resource revision has changed');
    return this.writes.commit({
      type,
      kind,
      id: id ?? this.ids.generate(),
      fields,
      previous,
      command,
      at: this.now(),
    });
  }
}
