export type AppVersionDto = {
  appId: string;
  version: string;
  releaseDate: Date;
  releaseType: 'major' | 'minor' | 'patch';
  isLatest: boolean;
  isCritical?: boolean;
};
