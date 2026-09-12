import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject, signal } from '@angular/core';

export interface ApplicationDraftInput {
  name: string;
  slug: string;
  website: string;
  description: string;
}

export interface ApplicationDraft extends ApplicationDraftInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnershipDraft {
  appSlug: string;
  evidenceUrl: string;
  notes: string;
  updatedAt: string;
}

interface DraftStore {
  version: 1;
  applications: ApplicationDraft[];
  ownership: OwnershipDraft[];
}

export const APPLICATION_DRAFT_STORAGE_KEY =
  'wapps.aggregator.application-drafts.v1';
export const APPLICATION_DRAFT_STORAGE = new InjectionToken<Storage | null>(
  'Application draft storage',
  {
    providedIn: 'root',
    factory: () => {
      try {
        return inject(DOCUMENT).defaultView?.localStorage ?? null;
      } catch {
        return null;
      }
    },
  }
);

export function isDraftSlug(value: string): boolean {
  return value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isDraftUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      value.length <= 2048 &&
      ['https:', 'http:'].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function validateApplicationDraft(
  value: ApplicationDraftInput
): string | null {
  if (value.name.trim().length < 2 || value.name.trim().length > 100)
    return 'Use an application name between 2 and 100 characters.';
  if (!isDraftSlug(value.slug.trim()))
    return 'Use a slug of up to 80 lowercase letters, numbers, and single hyphens between words.';
  if (!isDraftUrl(value.website.trim()))
    return 'Enter a complete HTTP or HTTPS website URL without embedded credentials.';
  if (
    value.description.trim().length < 20 ||
    value.description.trim().length > 2000
  )
    return 'Describe the application in 20–2,000 characters.';
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isApplication(value: unknown): value is ApplicationDraft {
  return (
    isRecord(value) &&
    ['name', 'slug', 'website', 'description'].every(
      (key) => typeof value[key] === 'string'
    ) &&
    typeof value['id'] === 'string' &&
    !!value['id'] &&
    isDate(value['createdAt']) &&
    isDate(value['updatedAt']) &&
    !validateApplicationDraft(value as unknown as ApplicationDraftInput)
  );
}

function isOwnership(value: unknown): value is OwnershipDraft {
  return (
    isRecord(value) &&
    typeof value['appSlug'] === 'string' &&
    isDraftSlug(value['appSlug']) &&
    typeof value['evidenceUrl'] === 'string' &&
    isDraftUrl(value['evidenceUrl']) &&
    typeof value['notes'] === 'string' &&
    value['notes'].trim().length >= 20 &&
    value['notes'].length <= 2000 &&
    isDate(value['updatedAt'])
  );
}

/** Local drafts only. This service never submits data or establishes ownership. */
@Injectable({ providedIn: 'root' })
export class LocalApplicationDraftsService {
  private readonly storage = inject(APPLICATION_DRAFT_STORAGE);
  private readonly state = signal<DraftStore>({
    version: 1,
    applications: [],
    ownership: [],
  });
  readonly data = this.state.asReadonly();
  readonly error = signal<string | null>(null);

  constructor() {
    this.refresh();
  }

  refresh(): boolean {
    try {
      if (!this.storage) throw new Error('unavailable');
      const raw = this.storage.getItem(APPLICATION_DRAFT_STORAGE_KEY);
      const value: unknown =
        raw === null
          ? { version: 1, applications: [], ownership: [] }
          : JSON.parse(raw);
      if (
        !isRecord(value) ||
        value['version'] !== 1 ||
        !Array.isArray(value['applications']) ||
        !Array.isArray(value['ownership']) ||
        !value['applications'].every(isApplication) ||
        !value['ownership'].every(isOwnership)
      )
        throw new Error('invalid');
      const applications = value['applications'] as ApplicationDraft[];
      const ownership = value['ownership'] as OwnershipDraft[];
      if (
        new Set(applications.map((d) => d.id)).size !== applications.length ||
        new Set(applications.map((d) => d.slug)).size !== applications.length ||
        new Set(ownership.map((d) => d.appSlug)).size !== ownership.length
      )
        throw new Error('duplicate');
      this.state.set({ version: 1, applications, ownership });
      this.error.set(null);
      return true;
    } catch {
      this.error.set(
        'Local drafts could not be read. Browser storage may be unavailable or the saved data may be invalid. Existing data has not been overwritten.'
      );
      return false;
    }
  }

  saveApplication(
    input: ApplicationDraftInput,
    id?: string
  ): ApplicationDraft | null {
    const value = Object.fromEntries(
      Object.entries(input).map(([key, text]) => [key, text.trim()])
    ) as unknown as ApplicationDraftInput;
    const validation = validateApplicationDraft(value);
    if (validation) {
      this.error.set(validation);
      return null;
    }
    if (!this.refresh()) return null;
    const current = this.state();
    const previous = id
      ? current.applications.find((d) => d.id === id)
      : undefined;
    if (id && !previous) {
      this.error.set(
        'This draft no longer exists. Return to My Apps and create a new draft.'
      );
      return null;
    }
    if (
      current.applications.some((d) => d.slug === value.slug && d.id !== id)
    ) {
      this.error.set(
        'A local draft already uses this slug. Edit that draft or choose another slug.'
      );
      return null;
    }
    const now = new Date().toISOString();
    const draft: ApplicationDraft = {
      ...value,
      id:
        previous?.id ??
        Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) =>
          part.toString(16).padStart(8, '0')
        ).join(''),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    return this.persist({
      ...current,
      applications: [...current.applications.filter((d) => d.id !== id), draft],
    })
      ? draft
      : null;
  }

  saveOwnership(appSlug: string, evidenceUrl: string, notes: string): boolean {
    const draft = {
      appSlug,
      evidenceUrl: evidenceUrl.trim(),
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (!isOwnership(draft)) {
      this.error.set(
        'Enter a valid application slug, an HTTP or HTTPS evidence URL, and notes between 20 and 2,000 characters.'
      );
      return false;
    }
    if (!this.refresh()) return false;
    const current = this.state();
    return this.persist({
      ...current,
      ownership: [
        ...current.ownership.filter((d) => d.appSlug !== appSlug),
        draft,
      ],
    });
  }

  removeApplication(id: string): boolean {
    if (!this.refresh()) return false;
    return this.persist({
      ...this.state(),
      applications: this.state().applications.filter((d) => d.id !== id),
    });
  }

  removeOwnership(appSlug: string): boolean {
    if (!this.refresh()) return false;
    return this.persist({
      ...this.state(),
      ownership: this.state().ownership.filter((d) => d.appSlug !== appSlug),
    });
  }

  private persist(value: DraftStore): boolean {
    try {
      if (!this.storage) throw new Error('unavailable');
      this.storage.setItem(
        APPLICATION_DRAFT_STORAGE_KEY,
        JSON.stringify(value)
      );
      this.state.set(value);
      this.error.set(null);
      return true;
    } catch {
      this.error.set(
        'Changes were not saved. Browser storage may be full or disabled. Keep this page open and try again.'
      );
      return false;
    }
  }
}
