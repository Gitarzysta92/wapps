export interface IdentityNodeDeletionEvent {
  identityId: string;
  subjectId: string;
  provider: string;
  deletedAt: number;
}