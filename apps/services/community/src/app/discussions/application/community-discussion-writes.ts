import type {
  DiscussionWriteRepository as KeyedWrites,
  DiscussionResource as KeyedResource,
  PreparedDiscussionMutation as KeyedMutation,
} from '@sdk/features/discussion/libs/management';
import { discussionMentionRecipients } from '@domains/community';
import type { DiscussionTarget } from '@domains/community';
import type {
  DiscussionResource,
  DiscussionWriteRepository,
  PreparedDiscussionMutation,
} from './discussion-write.port';
import {
  communityDiscussionKey,
  communityDiscussionTarget,
} from './community-discussion-binding';

function bind(
  resource: DiscussionResource,
  targetForKey: (key: string) => DiscussionTarget | null
): KeyedResource {
  const { target, ...fields } = resource;
  const bindingKey = target
    ? communityDiscussionKey(target)
    : resource.bindingKey ?? null;
  if (
    bindingKey &&
    JSON.stringify(targetForKey(bindingKey)) !== JSON.stringify(target ?? null)
  )
    throw new Error('Inconsistent consumer binding metadata');
  return {
    ...fields,
    bindingKey,
  };
}
function unbind(
  resource: KeyedResource,
  targetForKey: (key: string) => DiscussionTarget | null
): DiscussionResource {
  const { bindingKey, ...fields } = resource;
  const target = bindingKey ? targetForKey(bindingKey) : null;
  return {
    ...fields,
    target,
    ...(bindingKey && !target ? { bindingKey } : {}),
  };
}

/** Consumer persistence adapter; all target interpretation stays outside the SDK. */
export function communityDiscussionWrites(
  writes: DiscussionWriteRepository,
  targetForKey: (
    key: string
  ) => DiscussionTarget | null = communityDiscussionTarget
): KeyedWrites {
  return {
    resource: async (id) => {
      const resource = await writes.resource(id);
      return resource ? bind(resource, targetForKey) : null;
    },
    resources: async (id) =>
      (await writes.resources(id)).map((resource) =>
        bind(resource, targetForKey)
      ),
    receipt: (command) => writes.receipt(command),
    commit: (mutation: KeyedMutation) => {
      let prepared: PreparedDiscussionMutation;
      if (mutation.type === 'create') {
        const { bindingKey, context, ...fields } = mutation;
        const target = bindingKey ? targetForKey(bindingKey) : null;
        prepared = {
          ...fields,
          ...(target ? { target } : bindingKey ? { bindingKey } : {}),
          mentions: recipients(context),
        };
      } else if (mutation.type === 'reply' || mutation.type === 'update') {
        const { context, ...fields } = mutation;
        prepared = {
          ...fields,
          resource: unbind(mutation.resource, targetForKey),
          mentions: recipients(context),
        };
      } else
        prepared = {
          ...mutation,
          resource: unbind(mutation.resource, targetForKey),
        };
      return writes.commit(prepared);
    },
  };
}

function recipients(context: unknown) {
  if (context === undefined) return [];
  if (!Array.isArray(context))
    throw new Error('Invalid community write context');
  return discussionMentionRecipients(
    context,
    context.map((row) => row?.profileId)
  );
}
