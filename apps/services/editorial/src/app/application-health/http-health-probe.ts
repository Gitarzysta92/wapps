import { Resolver } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
  type RequestOptions,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import { performance } from 'node:perf_hooks';
import { healthUrl, type HealthObservation } from '@domains/reliability';
import type { HealthProbe } from './application-health';

type Evidence = Pick<
  HealthObservation,
  'status' | 'reason' | 'httpStatus' | 'durationMs'
>;
interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}
const denied = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  denied.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  denied.addSubnet(address, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export function isPublicHealthAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !denied.check(address, 'ipv4');
  return (
    family === 6 &&
    !address.includes('%') &&
    globalV6.check(address, 'ipv6') &&
    !denied.check(address, 'ipv6')
  );
}
async function resolveHost(hostname: string): Promise<ResolvedAddress[]> {
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  const timeout = setTimeout(() => resolver.cancel(), 2500);
  try {
    const values = await Promise.allSettled([
      resolver.resolve4(hostname),
      resolver.resolve6(hostname),
    ]);
    return values.flatMap((value, index) =>
      value.status === 'fulfilled'
        ? value.value.map((address) => ({
            address,
            family: (index ? 6 : 4) as 4 | 6,
          }))
        : []
    );
  } finally {
    clearTimeout(timeout);
    resolver.cancel();
  }
}
type Request = (
  url: URL,
  options: RequestOptions,
  response: (response: IncomingMessage) => void
) => ClientRequest;

/** Resolve once, reject any private answer, pin the connection, and never follow redirects. */
export class HttpHealthProbe implements HealthProbe {
  constructor(
    private readonly resolve: (
      hostname: string
    ) => Promise<ResolvedAddress[]> = resolveHost,
    private readonly request: Request = (url, options, response) =>
      (url.protocol === 'https:' ? httpsRequest : httpRequest)(
        url,
        options,
        response
      )
  ) {}
  async observe(input: string): Promise<Evidence> {
    const unknown = (reason: 'network-error' | 'blocked-target'): Evidence => ({
      status: 'unknown',
      reason,
      httpStatus: null,
      durationMs: null,
    });
    let url: URL;
    try {
      url = new URL(healthUrl(input));
    } catch {
      return unknown('blocked-target');
    }
    let addresses: ResolvedAddress[];
    try {
      addresses = await this.resolve(url.hostname);
    } catch {
      return unknown('network-error');
    }
    if (!addresses.length) return unknown('network-error');
    if (
      addresses.length > 32 ||
      addresses.some(
        (value) =>
          isIP(value.address) !== value.family ||
          !isPublicHealthAddress(value.address)
      )
    )
      return unknown('blocked-target');
    const selected =
      addresses.find((value) => value.family === 4) ?? addresses[0];
    const started = performance.now();
    return new Promise((resolve) => {
      const signal = AbortSignal.timeout(10_000);
      try {
        const request = this.request(
          url,
          {
            method: 'GET',
            agent: false,
            maxHeaderSize: 16_384,
            family: selected.family,
            lookup: (_hostname, _options, callback) =>
              callback(null, selected.address, selected.family),
            headers: { accept: '*/*', 'user-agent': 'WappsHealth/1.0' },
            signal,
          },
          (response) => {
            const durationMs = Math.min(
              15_000,
              Math.round(performance.now() - started)
            );
            const status = response.statusCode ?? 0;
            response.destroy();
            if (status >= 200 && status < 300)
              resolve({
                status: durationMs >= 2000 ? 'degraded' : 'operational',
                reason: durationMs >= 2000 ? 'http-slow' : 'http-success',
                httpStatus: status,
                durationMs,
              });
            else if (status >= 300 && status < 400)
              resolve({
                status: 'unknown',
                reason: 'redirect',
                httpStatus: status,
                durationMs,
              });
            else if (status === 401 || status === 403)
              resolve({
                status: 'unknown',
                reason: 'access-denied',
                httpStatus: status,
                durationMs,
              });
            else if (status >= 400 && status < 600)
              resolve({
                status: 'outage',
                reason: 'http-error',
                httpStatus: status,
                durationMs,
              });
            else resolve(unknown('network-error'));
          }
        );
        request.once('error', () =>
          resolve(
            signal.aborted
              ? {
                  status: 'outage',
                  reason: 'timeout',
                  httpStatus: null,
                  durationMs: 10_000,
                }
              : unknown('network-error')
          )
        );
        request.end();
      } catch {
        resolve(unknown('network-error'));
      }
    });
  }
}
