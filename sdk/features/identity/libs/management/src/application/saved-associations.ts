import {
  consumerBindingKey,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';

export interface SavedAssociationChange<Target> {
  expectedRevision: number;
  target: Target;
  saved: boolean;
}
export interface WatchedVersion {
  version: number;
  at: number;
}
export interface WatchedState<Target, Content> extends WatchedVersion {
  target: Target;
  content: Content | null;
}
export interface SavedAssociationCommands<Target, Receipt> {
  inspectChange(
    identityId: string,
    change: SavedAssociationChange<Target>,
    key: string
  ): Promise<Receipt | null>;
  change(
    identityId: string,
    change: SavedAssociationChange<Target>,
    key: string,
    baseline: WatchedVersion | null
  ): Promise<Receipt>;
}
export interface WatchedSource<Target, Content> {
  read(target: Target): Promise<WatchedState<Target, Content>>;
}
export interface SavedAssociationBinding<Target, Content> {
  key(target: Target): string;
  state(input: unknown): WatchedState<Target, Content>;
}

/** Caller authorizes the account; the store repeats lifecycle, receipt and revision checks under its lock. */
export class ChangeSavedAssociation<Target, Content, Receipt> {
  constructor(
    private readonly store: SavedAssociationCommands<Target, Receipt>,
    private readonly available: (target: Target) => Promise<boolean>,
    private readonly source: WatchedSource<Target, Content>,
    private readonly binding: SavedAssociationBinding<Target, Content>
  ) {}
  async change(
    identityId: string,
    change: SavedAssociationChange<Target>,
    key: string
  ): Promise<Receipt> {
    const expected = consumerBindingKey(this.binding.key(change.target));
    const receipt = await this.store.inspectChange(identityId, change, key);
    if (receipt) return receipt;
    // Removal and exact replay must not depend on a target that may have disappeared.
    if (!change.saved) return this.store.change(identityId, change, key, null);
    if (!(await this.available(change.target)))
      throw new CanonicalIdentityInputError('Favorite target is unavailable');
    const state = this.binding.state(await this.source.read(change.target));
    if (
      !state.content ||
      consumerBindingKey(this.binding.key(state.target)) !== expected
    )
      throw new CanonicalIdentityInputError('Favorite target is unavailable');
    return this.store.change(identityId, change, key, {
      version: state.version,
      at: state.at,
    });
  }
}

export interface WatchedLease<Target> {
  target: Target;
}
export interface WatchedUpdatesStore<
  Target,
  Content,
  Lease extends WatchedLease<Target>
> {
  claim(): Promise<Lease | null>;
  settle(lease: Lease, state: WatchedState<Target, Content>): Promise<void>;
  fail(lease: Lease): Promise<void>;
}
export class DeliverWatchedUpdates<
  Target,
  Content,
  Lease extends WatchedLease<Target>
> {
  constructor(
    private readonly store: WatchedUpdatesStore<Target, Content, Lease>,
    private readonly source: WatchedSource<Target, Content>,
    private readonly binding: SavedAssociationBinding<Target, Content>
  ) {}
  async advance(): Promise<boolean> {
    const lease = await this.store.claim();
    if (!lease) return false;
    try {
      const state = this.binding.state(await this.source.read(lease.target));
      if (
        consumerBindingKey(this.binding.key(state.target)) !==
        consumerBindingKey(this.binding.key(lease.target))
      )
        throw new Error('Favorite update scope differs');
      await this.store.settle(lease, state);
      return true;
    } catch (error) {
      await this.store.fail(lease);
      throw error;
    }
  }
}
