import { createHash } from 'node:crypto';
import type { EditorialSnapshot } from '@apps/shared';
import type { EditorialResourceKind as EditorialProjectionKind } from './editorial.ports';
import {
  isEditorialResourceId,
  isEditorialScope,
  projectEditorialSnapshot,
} from './editorial-materialization';

export class EditorialBackfillError extends Error {}

export interface EditorialOwnershipManifest {
  version: 1;
  kind: EditorialProjectionKind;
  resourceId: string;
  tenantId: string;
  ownerIdentityId: string;
}

export interface EditorialBackfillPlan {
  manifest: EditorialOwnershipManifest;
  manifestFingerprint: string;
  sourceFingerprint: string;
  fingerprint: string;
}

export interface EditorialBackfillReceipt {
  kind: EditorialProjectionKind;
  resourceId: string;
  manifestFingerprint: string;
  sourceFingerprint: string;
  fingerprint: string;
  revision: 1;
}

export interface EditorialBackfillSource {
  read(manifest: EditorialOwnershipManifest): Promise<EditorialSnapshot>;
  receipt(
    manifest: EditorialOwnershipManifest
  ): Promise<EditorialBackfillReceipt | null>;
  /** Lock, recompute the reviewed plan, then commit ownership, receipt and outbox together. */
  commit(plan: EditorialBackfillPlan): Promise<EditorialBackfillReceipt>;
}

function requireBackfill(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) throw new EditorialBackfillError(message);
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function parseEditorialOwnershipManifest(
  input: unknown
): EditorialOwnershipManifest {
  requireBackfill(
    input && typeof input === 'object' && !Array.isArray(input),
    'Expected an ownership manifest object'
  );
  const value = Object.fromEntries(Object.entries(input));
  const keys = ['version', 'kind', 'resourceId', 'tenantId', 'ownerIdentityId'];
  requireBackfill(
    Object.keys(value).length === keys.length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)),
    'Unexpected ownership manifest fields'
  );
  const { version, kind, resourceId, tenantId, ownerIdentityId } = value;
  requireBackfill(
    version === 1 &&
      (kind === 'app' || kind === 'category' || kind === 'tag') &&
      isEditorialResourceId(resourceId) &&
      isEditorialScope(tenantId) &&
      isEditorialScope(ownerIdentityId),
    'Invalid verified ownership mapping'
  );
  return { version, kind, resourceId, tenantId, ownerIdentityId };
}

export function planEditorialBackfill(
  manifest: EditorialOwnershipManifest,
  snapshot: EditorialSnapshot
): EditorialBackfillPlan {
  const projection = projectEditorialSnapshot(snapshot);
  requireBackfill(
    projection.kind === manifest.kind &&
      projection.resourceId === manifest.resourceId &&
      projection.tenantId === manifest.tenantId &&
      projection.revision === 1 &&
      projection.deletedAt === null,
    'Legacy snapshot does not match the verified mapping'
  );
  const manifestFingerprint = hash(manifest);
  const sourceFingerprint = projection.fingerprint;
  return {
    manifest,
    manifestFingerprint,
    sourceFingerprint,
    fingerprint: hash({ version: 1, manifestFingerprint, sourceFingerprint }),
  };
}

export function assertEditorialBackfillReceipt(
  manifest: EditorialOwnershipManifest,
  fingerprint: string,
  receipt: EditorialBackfillReceipt
): void {
  requireBackfill(
    receipt.kind === manifest.kind &&
      receipt.resourceId === manifest.resourceId &&
      receipt.revision === 1 &&
      receipt.manifestFingerprint === hash(manifest) &&
      receipt.fingerprint ===
        hash({
          version: 1,
          manifestFingerprint: receipt.manifestFingerprint,
          sourceFingerprint: receipt.sourceFingerprint,
        }) &&
      receipt.fingerprint === fingerprint,
    'Resource was imported by a different reviewed plan'
  );
}

export class EditorialLegacyBackfill {
  constructor(private readonly source: EditorialBackfillSource) {}

  async plan(input: unknown): Promise<EditorialBackfillPlan> {
    const manifest = parseEditorialOwnershipManifest(input);
    return planEditorialBackfill(manifest, await this.source.read(manifest));
  }

  async apply(
    input: unknown,
    fingerprint: string,
    legacyWritersStopped: boolean
  ): Promise<EditorialBackfillReceipt> {
    requireBackfill(
      /^[a-f0-9]{64}$/.test(fingerprint) && legacyWritersStopped === true,
      'Apply requires a reviewed fingerprint and stopped legacy writers'
    );
    const manifest = parseEditorialOwnershipManifest(input);
    const receipt = await this.source.receipt(manifest);
    if (receipt) {
      assertEditorialBackfillReceipt(manifest, fingerprint, receipt);
      return receipt;
    }
    const plan = planEditorialBackfill(
      manifest,
      await this.source.read(manifest)
    );
    requireBackfill(
      plan.fingerprint === fingerprint,
      'Legacy source changed; inspect a new plan before applying'
    );
    const committed = await this.source.commit(plan);
    assertEditorialBackfillReceipt(manifest, fingerprint, committed);
    return committed;
  }
}
