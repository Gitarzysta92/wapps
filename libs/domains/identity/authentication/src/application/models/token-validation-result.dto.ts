import { PrincipalDto } from './principal.dto';

export type TokenValidationResultDto =
  | { authenticated: true; principal: PrincipalDto }
  | { authenticated: false; principal: Pick<PrincipalDto, 'anonymous'> };

