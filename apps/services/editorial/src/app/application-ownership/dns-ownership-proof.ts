import { Resolver } from 'node:dns/promises';
import { OwnershipUnavailableError } from '@domains/catalog/ownership';
import type { OwnershipProof } from './application-ownership';

interface TxtResolver {
  resolveTxt(name: string): Promise<string[][]>;
  cancel(): void;
}
export class DnsOwnershipProof implements OwnershipProof {
  static configured(servers?: string): DnsOwnershipProof {
    if (servers === undefined) return new DnsOwnershipProof();
    const values = servers.split(',').map((value) => value.trim());
    if (
      servers.length > 512 ||
      values.length > 4 ||
      values.some((value) => !value)
    )
      throw new Error(
        'EDITORIAL_OWNERSHIP_DNS_SERVERS must contain 1-4 DNS server IP addresses'
      );
    const resolve = () => {
      const resolver = new Resolver({ timeout: 2000, tries: 2 });
      resolver.setServers(values);
      return resolver;
    };
    resolve();
    return new DnsOwnershipProof(resolve);
  }
  constructor(
    private readonly resolve: () => TxtResolver = () =>
      new Resolver({ timeout: 2000, tries: 2 })
  ) {}
  async matches(name: string, value: string): Promise<boolean> {
    if (
      !/^_wapps-ownership\.[a-z0-9.-]{1,235}$/.test(name) ||
      !/^wapps-ownership=[0-9a-f]{64}$/.test(value)
    )
      throw new OwnershipUnavailableError('Invalid stored ownership challenge');
    const resolver = this.resolve();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const records = await Promise.race([
        resolver.resolveTxt(name),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            resolver.cancel();
            reject(
              new OwnershipUnavailableError(
                'Domain verification timed out. Retry the same request.'
              )
            );
          }, 5000);
        }),
      ]);
      if (
        records.length > 64 ||
        records.reduce((size, chunks) => size + chunks.join('').length, 0) >
          32768
      )
        throw new OwnershipUnavailableError(
          'Domain verification response exceeds the supported size'
        );
      return records.some((chunks) => chunks.join('') === value);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['ENODATA', 'ENOTFOUND'].includes(String(error.code))
      )
        return false;
      if (error instanceof OwnershipUnavailableError) throw error;
      throw new OwnershipUnavailableError(
        'Domain verification is unavailable. Retry the same request.'
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
