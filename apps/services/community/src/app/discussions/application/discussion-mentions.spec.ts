import { ok } from '@sdk/kernel/standard';
import { DurableDiscussionCommands } from './durable-discussion-commands';
import type {
  DiscussionActor,
  DiscussionResource,
  DiscussionWriteRepository,
  ImmutableDiscussionPayloads,
} from './discussion-write.port';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const target = { kind: 'article' as const, id: id(1) };
const actor: DiscussionActor = {
  identityId: 'Author',
  tenantId: 'default',
  roles: ['discussion:writer'],
};
const content = {
  displayName: 'Author',
  text: 'A post',
  mentions: [id(5), id(4)],
};
function fixture() {
  const current: DiscussionResource = {
    id: id(2),
    discussionId: id(2),
    ownerIdentityId: 'Author',
    rootOwnerIdentityId: 'Author',
    tenantId: 'default',
    target,
    revision: 3,
    kind: 'comment',
    state: 'published',
    visibility: 'public',
    rootState: 'published',
    rootVisibility: 'public',
    deletedAt: null,
    rootDeletedAt: null,
  };
  const writes: jest.Mocked<DiscussionWriteRepository> = {
    resource: jest.fn().mockResolvedValue(current),
    resources: jest.fn(),
    receipt: jest.fn().mockResolvedValue(null),
    commit: jest
      .fn()
      .mockResolvedValue({
        id: id(3),
        discussionId: id(2),
        revision: 4,
        projection: 'pending',
      }),
  };
  const payloads: jest.Mocked<ImmutableDiscussionPayloads> = {
    put: jest
      .fn()
      .mockResolvedValue({ key: 'immutable', sha256: 'hash', bytes: 100 }),
  };
  const resolve = jest
    .fn()
    .mockResolvedValue([{ profileId: id(4), identityId: 'Recipient' }]);
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const commands = new DurableDiscussionCommands(
    writes,
    payloads,
    { evaluate },
    { generate: () => id(3) },
    { visible: async () => true },
    { resolve }
  );
  return { commands, writes, payloads, resolve, evaluate };
}

const operations = [
  {
    name: 'create',
    run: (c: DurableDiscussionCommands) =>
      c.create({ target, subjectId: target.id, content }, actor, 'create'),
  },
  {
    name: 'reply',
    run: (c: DurableDiscussionCommands) =>
      c.reply(id(2), content, actor, 'reply', target),
  },
  {
    name: 'update',
    run: (c: DurableDiscussionCommands) =>
      c.update(id(2), { content, expectedRevision: 3 }, actor, 'edit', target),
  },
];
describe.each(operations)('mention preparation for $name', ({ run }) => {
  it('keeps credential identities outside immutable public content and passes bounded private recipients to the atomic writer', async () => {
    const f = fixture();
    await run(f.commands);
    expect(f.resolve).toHaveBeenCalledWith('Author', [id(4), id(5)]);
    const serialized = f.payloads.put.mock.calls[0][1].toString();
    expect(JSON.parse(serialized).content.mentions).toEqual([id(4), id(5)]);
    expect(serialized).not.toContain('Recipient');
    expect(f.writes.commit.mock.calls[0][0]).toMatchObject({
      mentions: [{ profileId: id(4), identityId: 'Recipient' }],
    });
  });
  it('does not upload or commit while recipient authority is unavailable', async () => {
    const f = fixture();
    f.resolve.mockRejectedValue(new Error('Account unavailable'));
    await expect(run(f.commands)).rejects.toThrow('Account unavailable');
    expect(f.payloads.put).not.toHaveBeenCalled();
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
  it('replays the exact receipt before recipient lookup', async () => {
    const f = fixture();
    const receipt = {
      id: id(3),
      discussionId: id(2),
      revision: 3,
      projection: 'pending' as const,
    };
    f.writes.receipt.mockResolvedValue(receipt);
    f.resolve.mockRejectedValue(new Error('Account unavailable'));
    expect(await run(f.commands)).toEqual(receipt);
    expect(f.resolve).not.toHaveBeenCalled();
    expect(f.payloads.put).not.toHaveBeenCalled();
  });
  it('does not resolve recipients before authorization', async () => {
    const f = fixture();
    f.evaluate.mockResolvedValue(ok(false));
    await expect(run(f.commands)).rejects.toThrow();
    expect(f.resolve).not.toHaveBeenCalled();
  });
  it('retains unavailable public references without generating delivery recipients', async () => {
    const f = fixture();
    f.resolve.mockResolvedValue([]);
    await run(f.commands);
    expect(f.writes.commit.mock.calls[0][0]).toMatchObject({ mentions: [] });
  });
  it.each([
    { recipients: [{ profileId: id(8), identityId: 'Other' }] },
    { recipients: [{ profileId: id(4), identityId: 'Author' }] },
  ])(
    'rejects directory scope violations $recipients',
    async ({ recipients }) => {
      const f = fixture();
      f.resolve.mockResolvedValue(recipients);
      await expect(run(f.commands)).rejects.toThrow();
      expect(f.payloads.put).not.toHaveBeenCalled();
    }
  );
});
