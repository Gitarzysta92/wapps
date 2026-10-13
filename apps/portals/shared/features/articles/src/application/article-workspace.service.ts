import {
  DestroyRef,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  of,
  Subject,
  takeUntil,
  type Observable,
} from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  ARTICLE_LIMITS,
  assertArticleDeletion,
  assertArticlePublicationTransition,
  assertArticleSlug,
  parseArticleFields,
  parseArticlePublicationInput,
  type ArticleDraft,
  type ArticleFields,
  type ArticlePublicationAction,
  type ArticlePublicationStatus,
} from '@domains/publication/article';
import {
  ARTICLE_SESSION,
  ARTICLE_WORKSPACE,
  ArticleRequestError,
  type ArticleChange,
  type ArticleChangeReceipt,
} from './article-workspace.port';

export type ArticleWorkspaceView = 'list' | 'new' | 'edit' | 'queue' | 'review';
export interface ArticleWorkspaceLocation {
  view: ArticleWorkspaceView;
  id?: string;
  page?: number;
}
const emptyFields = (): ArticleFields => ({
  title: '',
  slug: '',
  excerpt: '',
  byline: '',
  category: '',
  tags: [],
  sections: [{ heading: '', paragraphs: [''] }],
});
const fieldsOf = (value: ArticleFields): ArticleFields => ({
  title: value.title,
  slug: value.slug,
  excerpt: value.excerpt,
  byline: value.byline,
  category: value.category,
  tags: [...value.tags],
  ...(value.classification ? { classification: value.classification } : {}),
  ...(value.cover ? { cover: { ...value.cover } } : {}),
  sections: value.sections.map((section) => ({
    heading: section.heading,
    paragraphs: [...section.paragraphs],
  })),
});

@Injectable({ providedIn: 'root' })
export class ArticleWorkspaceService {
  private readonly port = inject(ARTICLE_WORKSPACE);
  private readonly session = inject(ARTICLE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly sessionChanged = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private current: ArticleWorkspaceLocation = { view: 'list' };
  private locationVersion = 0;
  private attempt: { command: ArticleChange; key: string } | null = null;
  readonly sessionVersion = signal(0);
  readonly signedIn = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uncertain = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly items = signal<ArticleDraft[]>([]);
  readonly draft = signal<ArticleDraft | null>(null);
  readonly status = signal<ArticlePublicationStatus | null>(null);
  readonly fields = signal<ArticleFields>(emptyFields());
  readonly tagsText = signal('');
  readonly queue = signal<ArticlePublicationStatus[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = ARTICLE_LIMITS.pageSize;
  readonly result = signal<ArticleChangeReceipt | null>(null);
  readonly createdHere = signal(false);
  readonly locked = computed(
    () => this.loading() || this.saving() || this.uncertain()
  );
  readonly dirty = computed(() => {
    const draft = this.draft();
    return (
      !!draft &&
      JSON.stringify(this.fields()) !== JSON.stringify(fieldsOf(draft))
    );
  });
  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.attempt = null;
        this.sessionChanged.next();
        this.readChanged.next();
        this.locationVersion++;
        this.clear();
        this.signedIn.set(key !== null);
        this.saving.set(false);
        this.uncertain.set(false);
        this.feedback.set('');
        this.sessionVersion.update((version) => version + 1);
      });
  }
  open(location: ArticleWorkspaceLocation, keepFeedback = false) {
    this.readChanged.next();
    this.locationVersion++;
    this.current = { ...location };
    this.clear();
    if (!keepFeedback) this.feedback.set('');
    if (!this.signedIn()) return;
    const page = location.page ?? 1;
    this.page.set(page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      this.error.set('Choose a valid page.');
      return;
    }
    this.loading.set(true);
    if (location.view === 'list')
      this.read(this.port.list(), (value) => this.items.set(value));
    else if (location.view === 'queue')
      this.read(this.port.reviews(page), (value) => {
        this.queue.set(value.items);
        this.total.set(value.total);
      });
    else if (location.view === 'review')
      this.read(this.port.status(location.id ?? '', true), (value) =>
        this.status.set(value)
      );
    else if (location.view === 'new') this.loading.set(false);
    else
      this.read(
        forkJoin({
          draft: this.port.read(location.id ?? ''),
          status: this.port.status(location.id ?? '', false),
        }).pipe(
          map((value) => {
            if (!value.draft.ok) return err(value.draft.error);
            if (!value.status.ok) return err(value.status.error);
            if (value.draft.value.revision !== value.status.value.revision)
              return err(
                new Error(
                  'The article changed while loading. Reload before continuing.'
                )
              );
            return ok({ draft: value.draft.value, status: value.status.value });
          })
        ),
        (value) => {
          this.draft.set(value.draft);
          this.status.set(value.status);
          this.fields.set(fieldsOf(value.draft));
          this.tagsText.set(value.draft.tags.join(', '));
        }
      );
  }
  reload() {
    if (!this.locked()) this.open(this.current);
  }
  setField<K extends keyof ArticleFields>(key: K, value: ArticleFields[K]) {
    if (this.locked()) return;
    this.fields.update((fields) => ({ ...fields, [key]: value }));
    if (key === 'tags') this.tagsText.set(this.fields().tags.join(', '));
    this.feedback.set('');
  }
  setTags(value: string) {
    if (this.locked()) return;
    this.setField(
      'tags',
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    );
    this.tagsText.set(value);
  }
  setHeading(index: number, value: string) {
    this.setField(
      'sections',
      this.fields().sections.map((section, at) =>
        at === index ? { ...section, heading: value } : section
      )
    );
  }
  setParagraph(sectionIndex: number, index: number, value: string) {
    this.setField(
      'sections',
      this.fields().sections.map((section, at) =>
        at === sectionIndex
          ? {
              ...section,
              paragraphs: section.paragraphs.map((paragraph, position) =>
                position === index ? value : paragraph
              ),
            }
          : section
      )
    );
  }
  addSection() {
    if (this.fields().sections.length < ARTICLE_LIMITS.sections)
      this.setField('sections', [
        ...this.fields().sections,
        { heading: '', paragraphs: [''] },
      ]);
  }
  removeSection(index: number) {
    if (this.fields().sections.length > 1)
      this.setField(
        'sections',
        this.fields().sections.filter((_, at) => at !== index)
      );
  }
  addParagraph(index: number) {
    this.setField(
      'sections',
      this.fields().sections.map((section, at) =>
        at === index && section.paragraphs.length < ARTICLE_LIMITS.paragraphs
          ? { ...section, paragraphs: [...section.paragraphs, ''] }
          : section
      )
    );
  }
  removeParagraph(sectionIndex: number, index: number) {
    this.setField(
      'sections',
      this.fields().sections.map((section, at) =>
        at === sectionIndex && section.paragraphs.length > 1
          ? {
              ...section,
              paragraphs: section.paragraphs.filter(
                (_, position) => position !== index
              ),
            }
          : section
      )
    );
  }
  save() {
    this.prepare(() => {
      const fields = parseArticleFields(this.fields()),
        draft = this.draft();
      assertArticleSlug(fields, this.status()?.publicSlug ?? null);
      if (draft)
        return {
          kind: 'draft',
          type: 'update',
          id: draft.id,
          input: { ...fields, expectedRevision: draft.revision },
        };
      if (this.current.view !== 'new' || this.createdHere())
        throw new Error('Open a new article draft first.');
      return { kind: 'draft', type: 'create', input: fields };
    });
  }
  remove() {
    this.prepare(() => {
      const draft = this.draft(),
        status = this.status();
      if (!draft || !status || this.current.view !== 'edit')
        throw new Error('Open the saved article draft first.');
      assertArticleDeletion(status);
      return {
        kind: 'draft',
        type: 'delete',
        id: draft.id,
        input: { expectedRevision: draft.revision },
      };
    });
  }
  publish(action: ArticlePublicationAction, reason = '') {
    this.prepare(() => {
      const status = this.status(),
        review = action === 'approve' || action === 'reject';
      if (
        !status ||
        (review ? this.current.view !== 'review' : this.current.view !== 'edit')
      )
        throw new Error('Open the appropriate article workspace first.');
      if (action === 'submit' && this.dirty())
        throw new Error('Save your changes before submitting for review.');
      const input = parseArticlePublicationInput(action, {
        expectedRevision: status.revision,
        expectedPublicationRevision: status.publicationRevision,
        ...(review
          ? {
              submittedRevision: status.latestSubmission?.submittedRevision,
              reason,
            }
          : {}),
      });
      assertArticlePublicationTransition(action, status, input);
      return { kind: 'publication', id: status.id, action, input };
    });
  }
  retry() {
    if (this.attempt) this.execute(this.attempt.command);
  }
  private prepare(command: () => ArticleChange) {
    if (this.locked()) return;
    try {
      this.execute(command());
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Invalid article change'
      );
    }
  }
  private execute(command: ArticleChange) {
    if (
      !this.signedIn() ||
      !this.session.currentKey() ||
      this.loading() ||
      this.saving()
    )
      return;
    if (
      this.attempt &&
      JSON.stringify(this.attempt.command) !== JSON.stringify(command)
    ) {
      this.error.set(
        'Retry the unconfirmed request before making another change.'
      );
      return;
    }
    const attempt = (this.attempt ??= { command, key: crypto.randomUUID() }),
      locationVersion = this.locationVersion;
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    // Keep the exact request alive across page changes; an account change fences all continuations.
    defer(() => this.port.change(attempt.command, attempt.key))
      .pipe(
        catchError(() =>
          of(
            err(
              new ArticleRequestError(
                'The change could not be confirmed. Retry the same request.',
                true
              )
            )
          )
        ),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => {
          this.saving.set(false);
          if (this.attempt) this.uncertain.set(true);
        })
      )
      .subscribe((result) => {
        if (!result.ok) {
          const uncertain =
            result.error instanceof ArticleRequestError &&
            result.error.uncertain;
          if (!uncertain) this.attempt = null;
          this.uncertain.set(uncertain);
          this.error.set(result.error.message);
          return;
        }
        this.attempt = null;
        this.uncertain.set(false);
        if (
          locationVersion === this.locationVersion &&
          command.kind === 'draft' &&
          command.type === 'create' &&
          this.current.view === 'new'
        )
          this.createdHere.set(true);
        this.feedback.set(
          command.kind === 'publication'
            ? {
                submit: 'Submitted for independent review.',
                approve: 'Approved. The public article is updating.',
                reject: 'Submission rejected. The author can see your reason.',
                withdraw: 'Withdrawn. The article is no longer public.',
              }[command.action]
            : command.type === 'delete'
            ? 'Private draft deleted. Its withdrawn URL remains reserved.'
            : 'Article draft saved to your account.'
        );
        if (this.current.view === 'list' || this.current.view === 'queue')
          this.open(this.current, true);
        else if (
          locationVersion === this.locationVersion &&
          'id' in command &&
          this.current.id === command.id
        ) {
          if ('deleted' in result.value && result.value.deleted) this.clear();
          else this.open(this.current, true);
        }
        this.result.set(result.value);
      });
  }
  private read<T>(
    source: Observable<Result<T, Error>>,
    accept: (value: T) => void
  ) {
    source
      .pipe(
        catchError(() =>
          of(err(new Error('Articles could not be loaded. Try again.')))
        ),
        takeUntil(this.readChanged),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) accept(result.value);
        else this.error.set(result.error.message);
      });
  }
  private clear() {
    this.loading.set(false);
    this.items.set([]);
    this.draft.set(null);
    this.status.set(null);
    this.fields.set(emptyFields());
    this.tagsText.set('');
    this.queue.set([]);
    this.total.set(0);
    this.error.set('');
    this.result.set(null);
    this.createdHere.set(false);
  }
}
