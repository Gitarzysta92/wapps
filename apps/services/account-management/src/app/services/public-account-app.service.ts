import { Inject, Injectable } from '@nestjs/common';
import type { Collection, Document } from 'mongodb';
import { PlatformMongoClient } from '@infrastructure/mongo';
import { FirebaseAdminUserAdminPort } from '@infrastructure/firebase-identity';
import { IdentityProvisioner } from '../infrastructure/identity/identity-provisioner';
import { isErr, Result } from '@foundation/standard';
import { CompleteRegistrationRequestDto } from '../controllers/dto/complete-registration.request.dto';
import { PasswordRecoveryRequestDto } from '../controllers/dto/password-recovery.request.dto';

type AccountStatus = 'STUB' | 'ACTIVE' | 'DELETED';

type AccountDoc = Document & {
  _id: string; // identityId
  status: AccountStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
  registeredAt?: number;
  email?: string;
};

type ProfileAvatarDoc = {
  uri: string;
  alt: string;
};

type ProfileDoc = Document & {
  _id: string; // identityId
  name?: string;
  avatar?: ProfileAvatarDoc;
  bio?: string;
  location?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
};

function exposePasswordResetLink(): boolean {
  return String(process.env.EXPOSE_PASSWORD_RESET_LINK || '').toLowerCase() === 'true';
}

@Injectable()
export class PublicAccountAppService {
  private readonly firebaseAdmin = new FirebaseAdminUserAdminPort();

  constructor(
    @Inject('IDENTITY_EVENTS_PUBLISHER')
    private readonly events: {
      publishCreated: (args: any) => void;
      publishUpdated: (args: any) => void;
      publishDeleted: (args: any) => void;
    },
    private readonly identityProvisioner: IdentityProvisioner,
    private readonly mongo: PlatformMongoClient
  ) {}

  private accounts(): Collection<AccountDoc> {
    if (!this.mongo) throw new Error('Mongo not configured');
    return this.mongo.collection<AccountDoc>('accounts');
  }

  private profiles(): Collection<ProfileDoc> {
    if (!this.mongo) throw new Error('Mongo not configured');
    return this.mongo.collection<ProfileDoc>('profiles');
  }

  /**
   * Ensure we have an internal identity mapping and empty Account/Profile stubs.
   * This is safe to call on every authenticated request.
   */
  async ensureMe(uid: string, opts?: { email?: string }) {
    if (!this.identityProvisioner) {
      throw new Error('Identity provisioner not configured (Mongo/MySQL missing)');
    }

    const ensured = await this.identityProvisioner.ensureForFirebaseUid(uid);
    if (isErr(ensured)) throw ensured.error;

    if (ensured.value.created) {
      // Emit identity.created so other projections can bootstrap too.
      this.events.publishCreated({
        identityId: ensured.value.identityId,
        subjectId: ensured.value.subjectId,
        correlationId: ensured.value.identityId,
      });
    }

    const now = Date.now();
    await this.accounts().updateOne(
      { _id: ensured.value.identityId },
      {
        $setOnInsert: {
          _id: ensured.value.identityId,
          status: 'STUB',
          createdAt: now,
          updatedAt: now,
          deletedAt: 0,
          email: opts?.email,
        },
      },
      { upsert: true }
    );

    await this.profiles().updateOne(
      { _id: ensured.value.identityId },
      {
        $setOnInsert: {
          _id: ensured.value.identityId,
          createdAt: now,
          updatedAt: now,
          deletedAt: 0,
        },
      },
      { upsert: true }
    );

    const [account, profile] = await Promise.all([
      this.accounts().findOne({ _id: ensured.value.identityId }),
      this.profiles().findOne({ _id: ensured.value.identityId }),
    ]);

    return {
      uid,
      identityId: ensured.value.identityId,
      subjectId: ensured.value.subjectId,
      account,
      profile,
    };
  }

  async completeRegistration(args: {
    uid: string;
    dto: CompleteRegistrationRequestDto;
    email?: string;
  }) {
    const ensured = await this.ensureMe(args.uid, { email: args.email });
    const now = Date.now();

    await this.accounts().updateOne(
      { _id: ensured.identityId },
      {
        $set: {
          status: 'ACTIVE',
          updatedAt: now,
          registeredAt: now,
          ...(args.email ? { email: args.email } : {}),
        },
      }
    );

    await this.profiles().updateOne(
      { _id: ensured.identityId },
      {
        $set: {
          name: args.dto.name,
          bio: args.dto.bio,
          location: args.dto.location,
          avatar: args.dto.avatarUri
            ? { uri: args.dto.avatarUri, alt: args.dto.name }
            : undefined,
          updatedAt: now,
        },
      }
    );

    return await this.ensureMe(args.uid, { email: args.email });
  }

  async deleteMe(uid: string): Promise<Result<{ deleted: true }, Error>> {
    // Best effort: delete in Firebase (idempotent; do not leak existence).
    await this.firebaseAdmin.deleteUser(uid);

    try {
      const existing = await this.identityProvisioner?.getByFirebaseUid(uid);
      if (existing && existing.ok && existing.value?.identityId) {
        const now = Date.now();
        await Promise.all([
          this.accounts().updateOne(
            { _id: existing.value.identityId },
            { $set: { status: 'DELETED', updatedAt: now, deletedAt: now } },
            { upsert: true }
          ),
          this.profiles().updateOne(
            { _id: existing.value.identityId },
            { $set: { updatedAt: now, deletedAt: now } },
            { upsert: true }
          ),
        ]);
      }
    } catch {
      // ignore
    }

    try {
      await this.identityProvisioner?.deleteByFirebaseUid(uid);
    } catch {
      // ignore
    }

    return { ok: true, value: { deleted: true } };
  }

  /**
   * Public password recovery entrypoint.
   *
   * NOTE: For a production system you'd typically trigger an email (Firebase OOB
   * flow or your own mailer). For now we either return the link (dev) or just
   * acknowledge to avoid account enumeration.
   */
  async startPasswordRecovery(dto: PasswordRecoveryRequestDto): Promise<{ ok: true; link?: string }> {
    const link = await this.firebaseAdmin.generatePasswordResetLink(dto.email);

    if (!exposePasswordResetLink()) {
      // Do not leak whether the email exists.
      return { ok: true };
    }

    return { ok: true, link: link.ok ? link.value : undefined };
  }
}

