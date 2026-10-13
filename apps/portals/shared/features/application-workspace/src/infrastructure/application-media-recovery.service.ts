import { Injectable } from '@angular/core';
import { catchError, defer, map, of } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  applicationImageId,
  applicationImageInteger,
  applicationImageObject,
  parseApplicationImageChange,
  parseApplicationImageSource,
  parseApplicationImageUploadInput,
} from '@domains/catalog/media';
import type {
  ApplicationMediaAttempt,
  ApplicationMediaIntent,
  ApplicationMediaRecoveryPort,
} from '../application/application-media.port';

const storageKey = 'wapps.application-media.intent.v1';
export function parseApplicationMediaAttempt(
  input: unknown
): ApplicationMediaAttempt {
  const attempt = applicationImageObject(input, ['intent', 'key']);
  if (
    typeof attempt['key'] !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(attempt['key'])
  )
    throw new Error('Invalid image retry key');
  const data = applicationImageObject(attempt['intent'], [
    'type',
    'draftId',
    'input',
    'id',
    'source',
    'expectedRevision',
  ]);
  const draftId = applicationImageId(data['draftId']);
  let intent: ApplicationMediaIntent;
  if (data['type'] === 'reserve') {
    applicationImageObject(data, ['type', 'draftId', 'input']);
    const input = parseApplicationImageUploadInput(data['input']);
    if (input.draftId !== draftId) throw new Error('Unexpected image draft');
    intent = { type: 'reserve', draftId, input };
  } else if (data['type'] === 'attach') {
    applicationImageObject(data, ['type', 'draftId', 'input']);
    intent = {
      type: 'attach',
      draftId,
      input: parseApplicationImageChange(data['input']),
    };
  } else if (data['type'] === 'upload' || data['type'] === 'cancel') {
    const type = data['type'];
    applicationImageObject(data, [
      'type',
      'draftId',
      'id',
      'expectedRevision',
      ...(type === 'upload' ? ['source'] : []),
    ]);
    const id = applicationImageId(data['id']);
    const expectedRevision = applicationImageInteger(data['expectedRevision']);
    if (type === 'upload' && expectedRevision !== 1)
      throw new Error('Invalid pending upload revision');
    intent =
      type === 'upload'
        ? {
            type,
            draftId,
            id,
            expectedRevision,
            source: parseApplicationImageSource(data['source']),
          }
        : { type, draftId, id, expectedRevision };
  } else throw new Error('Invalid image retry operation');
  return { intent, key: attempt['key'] };
}

@Injectable({ providedIn: 'root' })
export class ApplicationMediaRecoveryService
  implements ApplicationMediaRecoveryPort
{
  private scope: string | null = null;
  private generation = 0;
  restore(session: string) {
    this.scope = session;
    const generation = ++this.generation;
    return this.result(async () => {
      const hash = await this.hash(session);
      if (generation !== this.generation) return null;
      const value = sessionStorage.getItem(storageKey);
      if (!value) return null;
      try {
        if (value.length > 4096) throw new Error('Oversized retry state');
        const stored = applicationImageObject(JSON.parse(value), [
          'version',
          'scope',
          'attempt',
        ]);
        if (stored['version'] !== 1) throw new Error('Unknown retry state');
        if (stored['scope'] !== hash) {
          sessionStorage.removeItem(storageKey);
          return null;
        }
        return parseApplicationMediaAttempt(stored['attempt']);
      } catch {
        sessionStorage.removeItem(storageKey);
        throw new Error(
          'Saved image retry data was invalid. Reload images to inspect their current state before continuing.'
        );
      }
    });
  }
  remember(session: string, attempt: ApplicationMediaAttempt | null) {
    const generation = this.generation;
    return this.result(async () => {
      const scope = await this.hash(session);
      if (session !== this.scope || generation !== this.generation)
        throw new Error('The account changed. Reopen application images.');
      if (attempt)
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 1,
            scope,
            attempt: parseApplicationMediaAttempt(attempt),
          })
        );
      else sessionStorage.removeItem(storageKey);
    });
  }
  clear() {
    this.scope = null;
    this.generation++;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* A later restore reports unavailable storage. */
    }
  }
  private async hash(session: string) {
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(session)
    );
    return Array.from(new Uint8Array(bytes), (value) =>
      value.toString(16).padStart(2, '0')
    ).join('');
  }
  private result<T>(operation: () => Promise<T>) {
    return defer(operation).pipe(
      map(ok),
      catchError((error: unknown) =>
        of(
          err(
            new Error(
              error instanceof Error && error.message.startsWith('Saved image')
                ? error.message
                : 'Image retry storage is unavailable. Allow session storage and reload before changing images.'
            )
          )
        )
      )
    );
  }
}
