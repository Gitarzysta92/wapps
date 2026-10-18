import { ConflictException, Injectable } from '@nestjs/common';
import {
  permitsContent,
  type ClassifiedContent,
} from '@domains/publication/classification';
import type { TrustedPortalViewer } from '../identity/trusted-portal-identity';
import { PortalPreferencesClient } from './portal-preferences.client';

export function filterClassifiedPage<T extends { items: ClassifiedContent[] }>(
  page: T,
  permits: (content: ClassifiedContent) => boolean
): T {
  return { ...page, items: page.items.filter(permits) };
}

@Injectable()
export class PortalContentPreferences {
  constructor(private readonly preferences: PortalPreferencesClient) {}

  async read<T>(
    viewer: TrustedPortalViewer,
    load: () => Promise<T>,
    filter: (value: T, permits: (content: ClassifiedContent) => boolean) => T
  ): Promise<T> {
    const actor =
      viewer.identityId === null
        ? null
        : {
            identityId: viewer.identityId,
            headers: viewer.headers,
          };
    const before = actor ? await this.preferences.read(actor) : null;
    const value = await load();
    if (actor && before) {
      const after = await this.preferences.read(actor);
      if (
        after.revision !== before.revision ||
        JSON.stringify(after.preferences) !== JSON.stringify(before.preferences)
      )
        throw new ConflictException(
          'Content preferences changed. Reload before trying again.'
        );
    }
    return filter(value, (content) =>
      permitsContent(
        content,
        before?.preferences.content.showMatureContent === true
      )
    );
  }
}
