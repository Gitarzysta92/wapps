import {
  ApplicationImageInputError,
  applicationImageId,
  applicationImageInteger,
  applicationImageObject,
  applicationImagePurpose,
  parseApplicationImageAsset,
  type ApplicationImageAsset,
  type ApplicationImagePurpose,
} from './application-image';

export type ApplicationImageReference =
  | { kind: 'upload'; asset: ApplicationImageAsset }
  | { kind: 'external'; url: string };
export interface ApplicationImageSet {
  logo: ApplicationImageReference | null;
  banner: ApplicationImageReference | null;
}
export interface ApplicationImageChange {
  expectedRevision: number;
  purpose: ApplicationImagePurpose;
  imageId: string | null;
}
export interface ApplicationImageMerge {
  logo: 'draft' | 'canonical';
  banner: 'draft' | 'canonical';
}
export function applicationImageExternalUrl(input: unknown): string {
  try {
    if (typeof input !== 'string' || input.length > 255 || /\s/.test(input))
      throw new Error();
    const url = new URL(input);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      throw new Error();
    return input;
  } catch {
    throw new ApplicationImageInputError(
      'Invalid existing application image URL'
    );
  }
}
export function parseApplicationImageReference(
  input: unknown,
  purpose: ApplicationImagePurpose
): ApplicationImageReference | null {
  if (input === null) return null;
  const value = applicationImageObject(input, ['kind', 'asset', 'url']);
  if (value['kind'] === 'external' && value['asset'] === undefined)
    return { kind: 'external', url: applicationImageExternalUrl(value['url']) };
  if (value['kind'] === 'upload' && value['url'] === undefined) {
    const asset = parseApplicationImageAsset(value['asset']);
    if (asset.purpose === purpose) return { kind: 'upload', asset };
  }
  throw new ApplicationImageInputError(
    'The image reference does not match its purpose'
  );
}
export function parseApplicationImageSet(input: unknown): ApplicationImageSet {
  const value = applicationImageObject(input, ['logo', 'banner']);
  return {
    logo: parseApplicationImageReference(value['logo'], 'logo'),
    banner: parseApplicationImageReference(value['banner'], 'banner'),
  };
}
export function parseApplicationImageChange(
  input: unknown
): ApplicationImageChange {
  const value = applicationImageObject(input, [
    'expectedRevision',
    'purpose',
    'imageId',
  ]);
  return {
    expectedRevision: applicationImageInteger(value['expectedRevision']),
    purpose: applicationImagePurpose(value['purpose']),
    imageId:
      value['imageId'] === null ? null : applicationImageId(value['imageId']),
  };
}
export function parseApplicationImageMerge(
  input: unknown
): ApplicationImageMerge {
  const value = applicationImageObject(input, ['logo', 'banner']);
  const logo = value['logo'];
  const banner = value['banner'];
  if (
    (logo !== 'draft' && logo !== 'canonical') ||
    (banner !== 'draft' && banner !== 'canonical')
  )
    throw new ApplicationImageInputError(
      'Choose draft or canonical content for each image'
    );
  return { logo, banner };
}
