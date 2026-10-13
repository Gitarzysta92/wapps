import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  profileActivityCursor,
  profileActivityPosition,
  type ProfileActivityPosition,
} from '@domains/customer/profiles';
import type { ProfileActivityCursors } from '@sdk/features/identity/libs/management';

export class EncryptedProfileActivityCursors implements ProfileActivityCursors {
  private readonly key: Buffer;
  constructor(secret: string) {
    if (!secret || secret.length > 1024)
      throw new Error('Invalid activity cursor configuration');
    this.key = createHash('sha256')
      .update('wapps-profile-activity-cursor-v1\0')
      .update(secret)
      .digest();
  }
  seal(input: ProfileActivityPosition, profileId: string): string {
    const position = profileActivityPosition(input),
      nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(this.scope(profileId));
    const payload = Buffer.concat([
      cipher.update(JSON.stringify(position), 'utf8'),
      cipher.final(),
    ]);
    return (
      'a1.' +
      Buffer.concat([nonce, cipher.getAuthTag(), payload]).toString('base64url')
    );
  }
  open(token: string, profileId: string): ProfileActivityPosition {
    profileActivityCursor(token);
    const raw = Buffer.from(token.slice(3), 'base64url');
    if (raw.length < 29 || raw.toString('base64url') !== token.slice(3))
      throw new Error('Invalid activity cursor');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      raw.subarray(0, 12)
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    decipher.setAAD(this.scope(profileId));
    const plaintext = Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]);
    return profileActivityPosition(JSON.parse(plaintext.toString('utf8')));
  }
  private scope(profileId: string): Buffer {
    return Buffer.from(
      JSON.stringify(['profile-activity-v1', profileId]),
      'utf8'
    );
  }
}
