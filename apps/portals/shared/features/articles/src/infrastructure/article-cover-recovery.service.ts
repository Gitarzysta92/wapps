import { Injectable } from '@angular/core';
import { catchError, defer, map, of } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  articleCoverId,
  articleCoverInteger,
  articleCoverObject,
  parseArticleCoverSource,
  parseArticleCoverUploadInput,
} from '@domains/catalog/media';
import type {
  ArticleCoverAttempt,
  ArticleCoverIntent,
  ArticleCoverRecoveryPort,
} from '../application/article-cover.port';

const storageKey = 'wapps.article-cover.intent.v1';
export function parseArticleCoverAttempt(input: unknown): ArticleCoverAttempt {
  const attempt = articleCoverObject(input, ['intent', 'key']);
  if (
    typeof attempt['key'] !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(attempt['key'])
  )
    throw new Error('Invalid image retry key');
  const data = articleCoverObject(attempt['intent'], [
    'type',
    'articleId',
    'input',
    'id',
    'source',
    'expectedRevision',
  ]);
  const articleId = articleCoverId(data['articleId']);
  let intent: ArticleCoverIntent;
  if (data['type'] === 'reserve') {
    articleCoverObject(data, ['type', 'articleId', 'input']);
    const input = parseArticleCoverUploadInput(data['input']);
    if (input.articleId !== articleId)
      throw new Error('Unexpected image draft');
    intent = { type: 'reserve', articleId, input };
  } else if (data['type'] === 'upload' || data['type'] === 'cancel') {
    const type = data['type'];
    articleCoverObject(data, [
      'type',
      'articleId',
      'id',
      'expectedRevision',
      ...(type === 'upload' ? ['source'] : []),
    ]);
    const id = articleCoverId(data['id']);
    const expectedRevision = articleCoverInteger(data['expectedRevision']);
    if (type === 'upload' && expectedRevision !== 1)
      throw new Error('Invalid pending upload revision');
    intent =
      type === 'upload'
        ? {
            type,
            articleId,
            id,
            expectedRevision,
            source: parseArticleCoverSource(data['source']),
          }
        : { type, articleId, id, expectedRevision };
  } else throw new Error('Invalid image retry operation');
  return { intent, key: attempt['key'] };
}

@Injectable({ providedIn: 'root' })
export class ArticleCoverRecoveryService implements ArticleCoverRecoveryPort {
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
        const stored = articleCoverObject(JSON.parse(value), [
          'version',
          'scope',
          'attempt',
        ]);
        if (stored['version'] !== 1) throw new Error('Unknown retry state');
        if (stored['scope'] !== hash) {
          sessionStorage.removeItem(storageKey);
          return null;
        }
        return parseArticleCoverAttempt(stored['attempt']);
      } catch {
        sessionStorage.removeItem(storageKey);
        throw new Error(
          'Saved image retry data was invalid. Reload images to inspect their current state before continuing.'
        );
      }
    });
  }
  remember(session: string, attempt: ArticleCoverAttempt | null) {
    const generation = this.generation;
    return this.result(async () => {
      const scope = await this.hash(session);
      if (session !== this.scope || generation !== this.generation)
        throw new Error('The account changed. Reopen article covers.');
      if (attempt)
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 1,
            scope,
            attempt: parseArticleCoverAttempt(attempt),
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
