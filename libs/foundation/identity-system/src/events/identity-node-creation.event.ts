export interface IdentityNodeCreationEvent {
  identityId: string;
  subjectId: string;
  provider: string;
  createdAt: number;
}