import { ok } from '@sdk/kernel/standard';
import { DurableDiscussionCommands } from './durable-discussion-commands';
import type {
  DiscussionActor,
  DiscussionResource,
  DiscussionWriteRepository,
  ImmutableDiscussionPayloads,
} from './discussion-write.port';

// Frozen from the pre-refactor command implementation, before introducing opaque keys.
const historical = {
  create: '52ede7313f87049caa7b00b42ce5da41df256c816febb0e423ee0052b53050b1',
  reply: '0ab49de1d0628e1b2285bb660eac42031c1f99266c9007050923ae142fe06abb',
  update: 'b5a8a55fe90621ee12ddf07562319efb90d38df933f65a2bb901550effd9eea5',
  delete: '19a189d26e14ce8659490ff318e2f6e5b31d896dbb3af4f3d2b2d9bd91973352',
  vote: '10cd4c2b2d350f3d754f898fe66ba1c453ab5e91b62dbcdbce169f45dc8178b9',
  pin: 'bd98c57bd23d9b5b0ca2ab52b19aa014676821e82c07cb67efa55d4667aa629e',
};
const actor: DiscussionActor = {
  identityId: 'owner',
  tenantId: 'default',
  roles: ['admin'],
};
const target = {
  kind: 'application' as const,
  id: '40e90383-a22e-4b5f-83c3-a7ef97f2e730',
};
const content = {
  title: 'A topic',
  text: 'Body',
  displayName: 'Owner',
  tags: [],
};
const resource: DiscussionResource = {
  id: 'root',
  discussionId: 'root',
  revision: 2,
  tenantId: 'default',
  ownerIdentityId: 'owner',
  rootOwnerIdentityId: 'owner',
  kind: 'discussion',
  state: 'published',
  visibility: 'public',
  rootState: 'published',
  rootVisibility: 'public',
  deletedAt: null,
  rootDeletedAt: null,
  target,
};
const operations = [
  [
    'create',
    (c: DurableDiscussionCommands) =>
      c.create({ target, subjectId: target.id, content }, actor, 'retry'),
  ],
  [
    'reply',
    (c: DurableDiscussionCommands) =>
      c.reply(
        'root',
        { text: 'Reply', displayName: 'Owner' },
        actor,
        'retry',
        target
      ),
  ],
  [
    'update',
    (c: DurableDiscussionCommands) =>
      c.update(
        'root',
        { content, expectedRevision: 2 },
        actor,
        'retry',
        target
      ),
  ],
  [
    'delete',
    (c: DurableDiscussionCommands) =>
      c.remove('root', 2, actor, 'retry', target),
  ],
  [
    'vote',
    (c: DurableDiscussionCommands) =>
      c.vote('root', { value: 1, expectedRevision: 2 }, actor, 'retry', target),
  ],
  [
    'pin',
    (c: DurableDiscussionCommands) =>
      c.pin(
        'root',
        { pinned: true, expectedRevision: 2 },
        actor,
        'retry',
        target
      ),
  ],
] as const;

describe('Wapps historical discussion request identities', () => {
  it.each(operations)(
    'replays the original %s fingerprint without new payload or side effects',
    async (operation, execute) => {
      const receipt = {
        id: 'root',
        discussionId: 'root',
        revision: 1,
        projection: 'pending' as const,
      };
      const writes: jest.Mocked<DiscussionWriteRepository> = {
        resource: jest.fn().mockResolvedValue(resource),
        resources: jest.fn(),
        receipt: jest.fn(async (command) => {
          expect(command.fingerprint).toBe(historical[operation]);
          return receipt;
        }),
        commit: jest.fn(),
      };
      const payloads: jest.Mocked<ImmutableDiscussionPayloads> = {
        put: jest.fn(),
      };
      const commands = new DurableDiscussionCommands(
        writes,
        payloads,
        { evaluate: async () => ok(true) },
        { generate: () => 'unused' },
        { visible: async () => true }
      );
      await expect(execute(commands)).resolves.toEqual(receipt);
      expect(payloads.put).not.toHaveBeenCalled();
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );
});
