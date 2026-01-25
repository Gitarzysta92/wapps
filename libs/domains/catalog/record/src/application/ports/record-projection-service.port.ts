export interface IRecordProjectionService {
  requestMaterialization(recordId: string): void;
}