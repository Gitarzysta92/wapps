import { Result } from '@sdk/kernel/standard';

export interface IDiscussionPayloadRepository {
  addPayload(
    discussionId: string,
    payload: any
  ): Promise<Result<boolean, Error>>;
}
