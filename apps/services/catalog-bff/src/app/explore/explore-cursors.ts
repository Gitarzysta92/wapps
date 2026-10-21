import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  ExploreInputError,
  ExploreUnavailableError,
  exploreObject,
  explorePosition,
  type ExploreCursors,
  type ExplorePosition,
} from '@domains/feed';

export class EncryptedExploreCursors implements ExploreCursors {
  constructor(
    private readonly secret: string | undefined,
    private readonly clock: () => number = Date.now,
    private readonly binding = ''
  ) {}
  private key() {
    if (!this.secret || !/^[A-Za-z0-9_-]{32,128}$/.test(this.secret))
      throw new ExploreUnavailableError(
        'Explore cursor configuration is unavailable'
      );
    return createHash('sha256')
      .update('wapps-explore-cursor-v1\0')
      .update(this.secret)
      .digest();
  }
  seal(position: ExplorePosition): string {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from('wapps-explore-v1' + this.binding));
    const body = Buffer.from(
      JSON.stringify({
        position: explorePosition(position),
        expires: this.clock() + 86_400_000,
      })
    );
    return (
      'e1.' +
      Buffer.concat([
        iv,
        cipher.update(body),
        cipher.final(),
        cipher.getAuthTag(),
      ]).toString('base64url')
    );
  }
  open(token: string): ExplorePosition {
    const key = this.key();
    try {
      if (!/^e1\.[A-Za-z0-9_-]{40,512}$/.test(token)) throw new Error();
      const encoded = token.slice(3),
        bytes = Buffer.from(encoded, 'base64url');
      if (bytes.toString('base64url') !== encoded || bytes.length <= 28)
        throw new Error();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        bytes.subarray(0, 12)
      );
      decipher.setAAD(Buffer.from('wapps-explore-v1' + this.binding));
      decipher.setAuthTag(bytes.subarray(-16));
      const value = exploreObject(
        JSON.parse(
          Buffer.concat([
            decipher.update(bytes.subarray(12, -16)),
            decipher.final(),
          ]).toString('utf8')
        ),
        ['position', 'expires']
      );
      const expires = value['expires'];
      if (
        typeof expires !== 'number' ||
        !Number.isSafeInteger(expires) ||
        expires <= this.clock() ||
        expires > this.clock() + 86_400_000
      )
        throw new Error();
      return explorePosition(value['position']);
    } catch {
      throw new ExploreInputError(
        'Activity page expired or is invalid. Refresh the feed.'
      );
    }
  }
}
