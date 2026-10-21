import { CanonicalIdentityInputError } from './canonical-identity';

/** Opaque, case-sensitive consumer identity; no embedded format is interpreted here. */
export function consumerBindingKey(input: unknown): string {
  if (typeof input !== 'string' || !/^[\x21-\x7e]{1,256}$/.test(input))
    throw new CanonicalIdentityInputError('Invalid consumer binding key');
  return input;
}

export function consumerProviderPlan(
  input: readonly string[]
): readonly string[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 32)
    throw new CanonicalIdentityInputError(
      'A bounded provider plan is required'
    );
  const plan = Array.from(input, consumerBindingKey);
  if (new Set(plan).size !== plan.length)
    throw new CanonicalIdentityInputError('Duplicate provider key');
  return Object.freeze(plan);
}
