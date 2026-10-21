import {
  PortalContentPreferences,
  filterClassifiedPage,
} from '../preferences/portal-content-preferences';
import { Injectable } from '@nestjs/common';
import {
  parseProfileDirectory,
  parsePublicProfileView,
  parseProfileFollow,
  parseProfileFollowerList,
  parseProfileFollowingList,
  parseProfileTotals,
  parseSharedProfileBadges,
  parseProfileBadgeAdministration,
  parseProfileBadgeEvent,
  parseProfileActivityPage,
  badgeObject,
  PROFILE_BADGE_KINDS,
  PROFILE_AVATAR_OUTPUT_LIMIT,
  type ProfileFollowChange,
  type ProfileBadgeChange,
} from '@domains/customer/profiles';
import {
  parsePublicProfileFavoritesPage,
  publicFavoriteKey,
} from '@domains/customer/favorites';
import { parseProfileSuitesPage } from '@domains/publication/suite';
import { parseProfileArticlesPage } from '@domains/publication/article';
import { parseProfileDiscussionsPage } from '@domains/community';
import type {
  TrustedPortalIdentity,
  TrustedPortalViewer,
} from '../identity/trusted-portal-identity';
import {
  PortalProfilesTransport,
  type ProfileSection,
} from './portal-profiles.transport';

function advancing(keys: string[], next: string | null, after: string | null) {
  if (
    keys.some(
      (key, index) =>
        (after !== null && key <= after) ||
        (index > 0 && key <= keys[index - 1])
    ) ||
    (next !== null &&
      ((after !== null && next <= after) || keys.some((key) => key > next)))
  )
    throw new Error('Invalid profile continuation');
}

@Injectable()
export class PortalProfilesClient {
  constructor(
    private readonly transport: PortalProfilesTransport,
    private readonly preferences: PortalContentPreferences
  ) {}

  async directory(viewer: TrustedPortalViewer, after: string | null) {
    const raw = await this.transport.send(viewer, '/api/profiles', { after });
    return this.transport.decode(() => {
      const page = parseProfileDirectory(raw);
      advancing(
        page.profiles.map((item) => item.id),
        page.after,
        after
      );
      if (
        page.profiles.some(
          (item) =>
            item.contactEmail !== undefined && item.contactEmail !== null
        )
      )
        throw new Error('Directory contains contact details');
      return page;
    });
  }

  async profile(viewer: TrustedPortalViewer, id: string) {
    const raw = await this.transport.send(viewer, `/api/profiles/${id}`);
    return this.transport.decode(() => {
      const view = parsePublicProfileView(raw);
      if (
        (view.profile && view.profile.id !== id) ||
        (view.follow && view.follow.ownerId !== id) ||
        (viewer.identityId === null && (view.isOwner || view.follow !== null))
      )
        throw new Error('Mismatched profile scope');
      return view;
    });
  }

  async avatar(viewer: TrustedPortalViewer, id: string, avatarId: string) {
    const raw = await this.transport.send(
      viewer,
      `/api/profiles/${id}/avatar/${avatarId}`,
      { binary: true }
    );
    return this.transport.decode(() => {
      if (
        !Buffer.isBuffer(raw) ||
        raw.length < 12 ||
        raw.length > PROFILE_AVATAR_OUTPUT_LIMIT ||
        raw.toString('ascii', 0, 4) !== 'RIFF' ||
        raw.toString('ascii', 8, 12) !== 'WEBP' ||
        raw.readUInt32LE(4) + 8 !== raw.length
      )
        throw new Error('Invalid public photo');
      return raw;
    });
  }

  async content(
    viewer: TrustedPortalViewer,
    id: string,
    section: ProfileSection,
    after: string | null
  ) {
    return this.preferences.read(
      viewer,
      async () => {
        const raw = await this.transport.send(
          viewer,
          `/api/profiles/${id}/${section}`,
          { after }
        );
        return this.transport.decode(() => {
          if (section === 'activity') {
            const page = parseProfileActivityPage(raw);
            if (page.after !== null && page.after === after)
              throw new Error('Repeated activity cursor');
            return page;
          }
          if (section === 'discussions') {
            const page = parseProfileDiscussionsPage(raw);
            if (page.after !== null && page.after === after)
              throw new Error('Repeated discussion cursor');
            return page;
          }
          if (section === 'favorites') {
            const page = parsePublicProfileFavoritesPage(raw);
            advancing(page.items.map(publicFavoriteKey), page.after, after);
            return page;
          }
          const page =
            section === 'suites'
              ? parseProfileSuitesPage(raw)
              : parseProfileArticlesPage(raw);
          advancing(
            page.items.map((item) => item.id),
            page.after,
            after
          );
          return page;
        });
      },
      filterClassifiedPage
    );
  }

  async follows(
    actor: TrustedPortalIdentity,
    outgoing: boolean,
    after: string | null
  ) {
    const raw = await this.transport.send(
      actor,
      outgoing ? '/api/me/profile-follows/outgoing' : '/api/me/profile-follows',
      { after }
    );
    return this.transport.decode(() => {
      if (outgoing) {
        const page = parseProfileFollowingList(raw);
        advancing(
          page.following.map((item) => item.ownerId),
          page.after,
          after
        );
        if (new Set(page.following.map((item) => item.requesterId)).size > 1)
          throw new Error('Mismatched follower scope');
        return page;
      }
      const page = parseProfileFollowerList(raw);
      advancing(
        page.followers.map((item) => item.requesterId),
        page.after,
        after
      );
      if (new Set(page.followers.map((item) => item.ownerId)).size > 1)
        throw new Error('Mismatched owner scope');
      return page;
    });
  }

  async follow(
    actor: TrustedPortalIdentity,
    input: ProfileFollowChange,
    key: string
  ) {
    const raw = await this.transport.send(actor, '/api/me/profile-follows', {
      data: input,
      key,
    });
    return this.transport.decode(() => {
      const receipt = parseProfileFollow(raw);
      const status =
        input.action === 'request'
          ? 'pending'
          : input.action === 'approve'
          ? 'approved'
          : 'none';
      if (
        receipt.ownerId !== input.ownerId ||
        receipt.requesterId !== input.requesterId ||
        receipt.revision !== input.expectedRevision + 1 ||
        receipt.status !== status
      )
        throw new Error('Mismatched follower receipt');
      return receipt;
    });
  }

  async totals(viewer: TrustedPortalViewer, id: string | null) {
    const raw = await this.transport.send(
      viewer,
      id === null ? '/api/me/totals' : `/api/profiles/${id}/totals`
    );
    return this.transport.decode(() => {
      const totals = parseProfileTotals(raw);
      if (id === null && Object.values(totals).some((value) => value === null))
        throw new Error('Incomplete private totals');
      return totals;
    });
  }

  async badges(viewer: TrustedPortalViewer, id: string | null) {
    const raw = await this.transport.send(
      viewer,
      id === null ? '/api/me/badges' : `/api/profiles/${id}/badges`
    );
    return this.transport.decode(() => {
      const value = parseSharedProfileBadges(raw);
      if (id === null && value.sharing !== 'visible')
        throw new Error('Hidden own badges');
      return value;
    });
  }

  async badgeCapabilities(actor: TrustedPortalIdentity) {
    const raw = await this.transport.send(actor, '/api/admin/profile-badges');
    return this.transport.decode(() => {
      const value = badgeObject(raw, ['kinds']);
      if (
        JSON.stringify(value['kinds']) !== JSON.stringify(PROFILE_BADGE_KINDS)
      )
        throw new Error('Invalid badge capabilities');
      return { kinds: [...PROFILE_BADGE_KINDS] };
    });
  }

  async badgeHistory(
    actor: TrustedPortalIdentity,
    id: string,
    after: string | null
  ) {
    const raw = await this.transport.send(
      actor,
      `/api/admin/profile-badges/${id}`,
      { after }
    );
    return this.transport.decode(() => {
      const value = parseProfileBadgeAdministration(raw);
      if (
        value.profileId !== id ||
        (after !== null &&
          value.events.some((event) => event.revision >= Number(after)))
      )
        throw new Error('Mismatched badge history');
      return value;
    });
  }

  async changeBadge(
    actor: TrustedPortalIdentity,
    id: string,
    input: ProfileBadgeChange,
    key: string
  ) {
    const raw = await this.transport.send(
      actor,
      `/api/admin/profile-badges/${id}`,
      { data: input, key }
    );
    return this.transport.decode(() => {
      const value = parseProfileBadgeEvent(raw);
      if (
        value.profileId !== id ||
        value.revision !== input.expectedRevision + 1 ||
        value.kind !== input.kind ||
        value.action !== input.action ||
        value.reason !== input.reason
      )
        throw new Error('Mismatched badge receipt');
      return value;
    });
  }
}
