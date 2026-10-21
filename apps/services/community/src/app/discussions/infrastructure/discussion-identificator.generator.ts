import { IDiscussionIdentificatorGenerator } from '@domains/discussion';
import { v7 as uuidv7 } from 'uuid';

export class CryptoDiscussionIdentificatorGenerator implements IDiscussionIdentificatorGenerator {
  generate(): string {
    return uuidv7();
  }
}

