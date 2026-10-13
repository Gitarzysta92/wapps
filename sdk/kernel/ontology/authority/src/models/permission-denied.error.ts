export class PermissionDeniedError extends Error {
  constructor(readonly action: string) {
    super(`Forbidden: ${action}`);
    this.name = 'PermissionDeniedError';
  }
}
