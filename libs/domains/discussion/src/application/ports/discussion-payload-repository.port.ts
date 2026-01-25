import { Result } from '@foundation/standard';

export interface IDiscussionPayloadRepository {
  addPayload(discussionId: string, payload: any): Promise<Result<boolean, Error>>;
}