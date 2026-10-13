import { Inject, Injectable } from '@nestjs/common';
import type { CanonicalIdentityStore } from '@sdk/features/identity/core';
import type {
  AccountStateStore,
  PasswordRecovery,
} from '@sdk/features/identity/libs/management';
import { CompleteRegistrationRequestDto } from '../controllers/dto/complete-registration.request.dto';
import { PasswordRecoveryRequestDto } from '../controllers/dto/password-recovery.request.dto';
import {
  ACCOUNT_STATE,
  CANONICAL_IDENTITIES,
  PASSWORD_RECOVERY,
} from './identity-state.tokens';

@Injectable()
export class PublicAccountAppService {
  constructor(
    @Inject(CANONICAL_IDENTITIES)
    private readonly identities: CanonicalIdentityStore,
    @Inject(ACCOUNT_STATE) private readonly accounts: AccountStateStore,
    @Inject(PASSWORD_RECOVERY) private readonly recovery: PasswordRecovery
  ) {}

  async ensureMe(uid: string, opts?: { email?: string }) {
    const state = await this.accounts.account(uid);
    return {
      uid,
      identityId: state.identityId,
      subjectId: state.subjectId,
      revision: state.revision,
      account: {
        status: state.status,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        registeredAt: state.registeredAt,
        email: opts?.email,
      },
      profile: {
        name: state.profile.name,
        bio: state.profile.bio,
        location: state.profile.location,
        avatar: state.profile.avatarUri
          ? { uri: state.profile.avatarUri, alt: state.profile.name ?? '' }
          : null,
      },
    };
  }

  completeRegistration(args: {
    uid: string;
    dto: CompleteRegistrationRequestDto;
    key: string;
  }) {
    return this.accounts.completeRegistration(
      args.uid,
      {
        name: args.dto.name,
        bio: args.dto.bio ?? null,
        location: args.dto.location ?? null,
        avatarUri: args.dto.avatarUri ?? null,
        expectedRevision: args.dto.expectedRevision,
      },
      args.key
    );
  }

  async deleteMe(uid: string) {
    const state = await this.identities.requestDeletion(uid);
    return {
      identityId: uid,
      revision: state.revision,
      status: 'accepted',
      cleanup: state.cleanup,
    } as const;
  }

  async startPasswordRecovery(dto: PasswordRecoveryRequestDto) {
    await this.recovery.send(dto.email);
    return { accepted: true } as const;
  }
}
