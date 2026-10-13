import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  commentObject,
  myDiscussionCursor,
  profileDiscussionsCursor,
  PublicCommentInputError,
  type MyDiscussionCursor,
} from '@sdk/features/discussion/core';
import type { ProfileDiscussionCursors } from '../application/profile-discussions';

export class EncryptedProfileDiscussionCursors
  implements ProfileDiscussionCursors
{
  private readonly key: Buffer;
  constructor(secret: string) {
    if (!secret || secret.length > 1024)
      throw new Error('Invalid profile cursor configuration');
    this.key = createHash('sha256')
      .update('wapps-profile-discussions-cursor-v1\0')
      .update(secret)
      .digest();
  }
  seal(input: MyDiscussionCursor, owner: string, tenant: string): string {
    const cursor = myDiscussionCursor(`${input.at}.${input.id}`);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(this.scope(owner, tenant));
    const payload = Buffer.concat([
      cipher.update(JSON.stringify(cursor), 'utf8'),
      cipher.final(),
    ]);
    return (
      'v1.' +
      Buffer.concat([nonce, cipher.getAuthTag(), payload]).toString('base64url')
    );
  }
  open(token: string, owner: string, tenant: string): MyDiscussionCursor {
    try {
      profileDiscussionsCursor(token);
      const raw = Buffer.from(token.slice(3), 'base64url');
      if (raw.toString('base64url') !== token.slice(3) || raw.length < 29)
        throw new Error('Noncanonical cursor');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        raw.subarray(0, 12)
      );
      decipher.setAuthTag(raw.subarray(12, 28));
      decipher.setAAD(this.scope(owner, tenant));
      const plaintext = Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]);
      const value = commentObject(JSON.parse(plaintext.toString('utf8')), [
        'at',
        'id',
      ]);
      return myDiscussionCursor(`${value['at']}.${value['id']}`);
    } catch {
      throw new PublicCommentInputError(
        'Invalid shared discussion cursor. Reload the first page.'
      );
    }
  }
  private scope(owner: string, tenant: string) {
    return Buffer.from(
      JSON.stringify(['profile-discussions-v1', owner, tenant]),
      'utf8'
    );
  }
}
