import {
  discussionMentionResolution,
  discussionMentionRecipients,
  NOTIFICATION_WORKER_ID,
  NOTIFICATION_WORKER_ROLE,
  NOTIFICATION_WORKER_SCOPE,
  type DiscussionMentionRecipient,
} from '@sdk/features/discussion/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import type { IdentityManagementContext } from './models/identity-management-context';
import {
  PublicProfileNotFound,
  type ProfileAudiencePolicy,
  type PublicProfileStore,
} from './ports/public-profile.port';
import type { PublicProfileContentOwnerStore } from './ports/public-profile-suites.port';

/** Service-only resolution never exposes credential identities through the public profile API. */
export class DiscussionMentionRecipients {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly audience: ProfileAudiencePolicy,
    private readonly profiles: PublicProfileStore &
      PublicProfileContentOwnerStore
  ) {}

  async resolve(
    input: unknown,
    context: IdentityManagementContext
  ): Promise<Result<{ recipients: DiscussionMentionRecipient[] }, Error>> {
    try {
      if (
        context.identityId !== NOTIFICATION_WORKER_ID ||
        context.tenantId !== NOTIFICATION_WORKER_SCOPE ||
        !context.subject?.roles?.includes(NOTIFICATION_WORKER_ROLE)
      )
        throw new CanonicalIdentityAccessDenied(
          'Mention resolver access denied'
        );
      const decision = await this.authority.validate({
        ...context,
        timestamp: Date.now(),
        actionName: 'identity.mention-recipients.read',
        resource: {
          type: 'mention-recipients',
          id: 'account',
          tenantId: context.tenantId,
        },
      });
      if (!decision.ok)
        throw new CanonicalIdentityUnavailable(
          'Mention authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied(
          'Mention resolver access denied'
        );
      let request;
      try {
        request = discussionMentionResolution(input);
      } catch {
        throw new CanonicalIdentityInputError('Invalid mention recipients');
      }
      const recipients: DiscussionMentionRecipient[] = [];
      for (const profileId of request.profileIds) {
        const snapshot = await this.profiles.inspect(
          profileId,
          request.authorId
        );
        if (!snapshot) continue;
        if (
          snapshot.profile.id !== profileId ||
          snapshot.facts.ownerId !== profileId
        )
          throw new CanonicalIdentityUnavailable(
            'Mention profile scope differs'
          );
        if (!snapshot.facts.viewerActive || !snapshot.facts.viewerRegistered)
          return ok({ recipients: [] });
        if (!snapshot.facts.ownerActive) continue;
        const allowed = await this.audience.evaluate('read', snapshot.facts);
        if (!allowed.ok)
          throw new CanonicalIdentityUnavailable(
            'Mention audience unavailable'
          );
        if (allowed.value !== true) continue;
        let identityId: string;
        try {
          identityId = await this.profiles.contentOwner(
            snapshot,
            request.authorId
          );
        } catch (error) {
          if (error instanceof PublicProfileNotFound) continue;
          throw error;
        }
        if (identityId === request.authorId) continue;
        const current = await this.profiles.confirm(snapshot, request.authorId);
        if (!current || current.stamp !== snapshot.stamp) continue;
        if (
          current.profile.id !== profileId ||
          current.facts.ownerId !== profileId
        )
          throw new CanonicalIdentityUnavailable(
            'Mention profile scope differs'
          );
        recipients.push({ profileId, identityId });
      }
      return ok({
        recipients: discussionMentionRecipients(recipients, request.profileIds),
      });
    } catch (error) {
      return err(
        error instanceof CanonicalIdentityAccessDenied ||
          error instanceof CanonicalIdentityInputError ||
          error instanceof CanonicalIdentityUnavailable
          ? error
          : new CanonicalIdentityUnavailable('Mention recipients unavailable')
      );
    }
  }
}
