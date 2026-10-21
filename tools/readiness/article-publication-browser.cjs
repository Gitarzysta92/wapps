const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

async function articlePublicationBrowser(options) {
  const { root, source, sql, policy, reader, projections } = options;
  const load = (name) =>
    require(path.join(root, 'apps/services/editorial/src/app', name));
  const { EditorialCommands } = load('application/editorial-commands');
  const { MysqlEditorialWrites } = load(
    'infrastructure/mysql-editorial-writes'
  );
  const { projectEditorialSnapshot } = load(
    'application/editorial-materialization'
  );
  const commands = new EditorialCommands(
    new MysqlEditorialWrites(source, 'default'),
    policy,
    { generate: randomUUID }
  );
  const publisher = {
    identityId: 'ArticleFavoritesPublisher',
    tenantId: 'default',
    roles: ['editorial:publisher'],
  };
  const project = async (kind, id) =>
    projections.publish(projectEditorialSnapshot(await reader.read(kind, id)));
  const json = async (
    method,
    route,
    body,
    actor = 'DraftBrowserAlice',
    roles = []
  ) => {
    const response = await fetch(options.origin() + '/api/' + route, {
      method,
      headers: {
        ...options.headers(actor, 'default', roles),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    assert(
      response.ok,
      `${method} ${route}: ${response.status} ${JSON.stringify(result)}`
    );
    return result;
  };
  const publication = (id) => json('GET', `me/articles/${id}/publication`);
  const fields = {
    title: 'First browser article',
    slug: 'browser-article',
    excerpt:
      'An article with a supplied public byline and exact reviewed text.',
    byline: 'Chosen public author',
    category: 'Guides',
    tags: ['privacy', 'offline'],
    sections: [
      {
        heading: 'Getting started',
        paragraphs: ['This is the exact reviewed body.'],
      },
    ],
  };
  await require('./account-favorites-journey.cjs').accountFavoritesJourney({
    root,
    sql,
    editorialOrigin: options.origin(),
    catalogOrigin: options.origin(),
    createTarget: (slug) =>
      commands.create(
        'app',
        {
          name: slug,
          slug,
          website: 'https://example.test',
          description: 'Article favorites regression target.',
        },
        publisher,
        randomUUID()
      ),
    renameTarget: (id, slug) =>
      commands.update(
        'app',
        id,
        { slug, expectedRevision: 1 },
        publisher,
        randomUUID()
      ),
    deleteTarget: (id, expectedRevision) =>
      commands.remove('app', id, { expectedRevision }, publisher, randomUUID()),
    publishTarget: (id) => project('app', id),
    hiddenTarget: randomUUID(),
    browser: false,
    additionalQualification: async ({
      accountOrigin,
      headers,
      identities,
      favorites,
      restartAccount,
    }) => {
      for (const uid of [
        'DraftBrowserAlice',
        'DraftBrowserBob',
        'DraftBrowserReviewer',
      ])
        await identities.ensure({
          uid,
          kind: 'user',
          provider: 'email',
          activate: true,
        });
      const restart = async () => {
        await options.restart();
        await restartAccount(options.origin());
      };
      await require('./application-draft-browser.cjs').applicationDraftBrowser({
        ...options,
        restart,
        accountOrigin,
        accountHeaders: headers,
        workflowOnly: true,
        articleWorkflow: async ({
          session,
          go,
          text,
          click,
          fill,
          capture,
          commands,
          loseResponse,
          setOffline,
        }) => {
          const author = await session('draft-alice');
          const independent = await session('draft-alice');
          const reviewer = await session('draft-reviewer');
          const stranger = await session('draft-bob');
          const publicReader = await session('');
          const idle = (page) =>
            page.waitForFunction(
              () =>
                document
                  .querySelector('app-article-workspace .application-workspace')
                  ?.getAttribute('aria-busy') === 'false'
            );
          const link = async (label, page) => {
            await page.waitForFunction(
              (label) =>
                [
                  ...document.querySelectorAll(
                    'app-article-workspace a, app-article-catalog a'
                  ),
                ].some((a) => a.textContent.trim() === label),
              {},
              label
            );
            await page.evaluate(
              (label) =>
                [
                  ...document.querySelectorAll(
                    'app-article-workspace a, app-article-catalog a'
                  ),
                ]
                  .find((a) => a.textContent.trim() === label)
                  .click(),
              label
            );
          };
          const confirm = async (action, page) => {
            await click(
              action === 'delete' ? 'Delete private draft' : 'Withdraw article',
              page
            );
            await capture('confirm-' + action, page);
            await click('Confirm ' + action, page);
            await idle(page);
          };
          await go('/articles', publicReader);
          await text('No published articles found', publicReader);
          await capture('public-empty', publicReader);
          await go('/my/articles', author);
          await text('No article drafts yet', author);
          await capture('owner-empty', author);
          await go('/my/articles/new', author);
          await author.focus('#article-title');
          await author.keyboard.press('Tab');
          assert.equal(
            await author.evaluate(() => document.activeElement.id),
            'article-slug'
          );
          for (const key of ['title', 'slug', 'excerpt', 'byline', 'category'])
            await fill('#article-' + key, fields[key], author);
          await author.focus('#article-tags');
          await author.keyboard.type('privacy, offline');
          assert.equal(
            await author.$eval('#article-tags', (input) => input.value),
            'privacy, offline'
          );
          await fill('#article-heading-0', fields.sections[0].heading, author);
          await fill(
            '#article-paragraph-0-0',
            fields.sections[0].paragraphs[0],
            author
          );
          await capture('draft-create', author);
          loseResponse(
            (route, method) => route === '/api/me/articles' && method === 'POST'
          );
          await click('Save article draft', author);
          await text('Retry unconfirmed change', author);
          const createKey = commands.at(-1).key;
          await capture('create-uncertain', author);
          await link('My articles', author);
          await text('Retry unconfirmed change', author);
          await click('Retry unconfirmed change', author);
          await text('Article draft saved to your account.', author);
          assert.equal(commands.at(-1).key, createKey);
          const [created] = await json('GET', 'me/articles');
          assert(created);
          assert.deepEqual(created.tags, fields.tags);
          const id = created.id,
            edit = '/my/articles/' + id,
            detail = '/articles/' + fields.slug;
          await go(edit, independent);
          await idle(independent);
          assert.equal(
            await independent.$eval('#article-title', (input) => input.value),
            fields.title
          );
          await go(edit, stranger);
          await text('not found', stranger);
          await capture('wrong-account', stranger);
          await go(edit, author);
          await click('Submit saved article', author);
          await text('Submitted for independent review.', author);
          await idle(author);
          await capture('submitted', author);
          await fill('#article-title', 'Private edit after submission', author);
          await click('Save article draft', author);
          await idle(author);
          await go('/editorial/articles/' + id, author);
          await text('Staff cannot review their own articles.', author);
          await capture('review-denied', author);
          await go('/editorial/articles', reviewer);
          await text(fields.title, reviewer);
          await capture('review-queue', reviewer);
          await go('/editorial/articles/' + id, reviewer);
          await text(fields.title, reviewer);
          assert(
            !(
              await reviewer.$eval(
                'app-article-workspace',
                (el) => el.textContent
              )
            ).includes('Private edit after submission')
          );
          await fill(
            '#article-review-reason',
            'Please explain compatibility.',
            reviewer
          );
          loseResponse((route) => route.endsWith('/decision'));
          await click('Reject submitted article', reviewer);
          await text('Retry unconfirmed change', reviewer);
          const rejectKey = commands.at(-1).key;
          await click('Retry unconfirmed change', reviewer);
          await text('Submission rejected.', reviewer);
          assert.equal(commands.at(-1).key, rejectKey);
          await go(edit, author);
          await text('Please explain compatibility.', author);
          await capture('rejected', author);
          await click('Submit saved article', author);
          await idle(author);
          await go('/editorial/articles/' + id, reviewer);
          await text('Private edit after submission', reviewer);
          await capture('review-frozen', reviewer);
          loseResponse((route) => route.endsWith('/decision'));
          await click('Approve submitted article', reviewer);
          await text('Retry unconfirmed change', reviewer);
          const approveKey = commands.at(-1).key;
          await click('Retry unconfirmed change', reviewer);
          await text('Approved. The public article is updating.', reviewer);
          assert.equal(commands.at(-1).key, approveKey);
          await go(detail, publicReader);
          await text('Retry loading articles', publicReader);
          await capture('projection-lag', publicReader);
          await project('article', id);
          await click('Retry loading articles', publicReader);
          await text(fields.sections[0].paragraphs[0], publicReader);
          await text('Sign in to save', publicReader);
          await capture('public-detail', publicReader);
          assert(
            !(
              await publicReader.$eval(
                'app-article-catalog',
                (el) => el.textContent
              )
            ).includes('DraftBrowserAlice')
          );
          await go('/articles', publicReader);
          await text('Private edit after submission', publicReader);
          await capture('public-list', publicReader);

          await go(detail, author);
          loseResponse((route) => route === '/api/me/favorites');
          await click('Add to Favorites', author);
          await author.waitForSelector('favorite-toggle-button [role="alert"]');
          const favoriteKey = commands.at(-1).key;
          await capture('favorite-uncertain', author);
          await click('Add to Favorites', author);
          await text('Remove from Favorites', author);
          assert.equal(commands.at(-1).key, favoriteKey);
          assert.equal(
            (await favorites.read('DraftBrowserAlice')).favorites[0].id,
            id
          );
          await go('/my/favourites/articles', independent);
          await text('Private edit after submission', independent);
          await capture('favorite-saved', independent);
          await go('/my/favourites/articles', stranger);
          await text('No favorites yet', stranger);
          await capture('favorite-other-account', stranger);

          await restart();
          await go('/my/favourites/articles', independent);
          await text('Private edit after submission', independent);
          await go(edit, independent);
          await idle(independent);
          await go(edit, author);
          await idle(author);
          await fill(
            '#article-title',
            'Private title after publication',
            author
          );
          await click('Save article draft', author);
          await idle(author);
          await fill(
            '#article-excerpt',
            'Keep this unsaved conflict text.',
            independent
          );
          await click('Save article draft', independent);
          await text('Reload', independent);
          await independent.waitForSelector('[role="alert"]');
          assert.equal(
            await independent.$eval('#article-excerpt', (input) => input.value),
            'Keep this unsaved conflict text.'
          );
          await capture('private-conflict', independent);
          await go(detail, publicReader);
          await text('Private edit after submission', publicReader);
          assert(
            !(
              await publicReader.$eval(
                'app-article-catalog',
                (el) => el.textContent
              )
            ).includes('Private title after publication')
          );
          await go(edit, author);
          await confirm('withdraw', author);
          await text('no longer public', author);
          await go(detail, publicReader);
          await text('not found', publicReader);
          await capture('withdrawn-detail', publicReader);
          await go('/my/favourites/articles', independent);
          await text('Unavailable article', independent);
          await capture('favorite-withdrawn', independent);
          await click('Remove from Favorites', independent);
          await text('No favorites yet', independent);
          assert.deepEqual(
            (await favorites.read('DraftBrowserAlice')).favorites,
            []
          );
          await go(edit, author);
          await confirm('delete', author);
          await text('Private draft deleted.', author);
          await project('article', id);
          await go('/my/articles', author);
          await text('No article drafts yet', author);
          setOffline(true);
          await go('/articles', publicReader);
          await text('Retry loading articles', publicReader);
          await capture('public-unavailable', publicReader);
          setOffline(false);
          await click('Retry loading articles', publicReader);
          await text('No published articles found', publicReader);

          for (let index = 1; index <= 21; index++) {
            const item = await json('POST', 'me/articles', {
              ...fields,
              title: `Published page article ${index}`,
              slug: `browser-page-${index}`,
              category: index === 21 ? 'News' : 'Guides',
              tags: index === 20 ? ['offline'] : ['privacy'],
            });
            const state = await publication(item.id);
            await json('POST', `me/articles/${item.id}/submit`, {
              expectedRevision: state.revision,
              expectedPublicationRevision: state.publicationRevision,
            });
            const pending = await publication(item.id);
            await json(
              'POST',
              `editorial/article-reviews/${item.id}/decision`,
              {
                decision: 'approve',
                expectedRevision: pending.revision,
                expectedPublicationRevision: pending.publicationRevision,
                submittedRevision: pending.latestSubmission.submittedRevision,
                reason: '',
              },
              'DraftBrowserReviewer',
              ['editorial:reviewer']
            );
            await project('article', item.id);
          }
          await go('/articles', publicReader);
          await text('21 articles', publicReader);
          assert.equal(
            await publicReader.$$eval(
              '.application-draft-grid article',
              (items) => items.length
            ),
            20
          );
          await capture('public-page-one', publicReader);
          await click('Next page', publicReader);
          await text('Page 2', publicReader);
          assert.equal(
            await publicReader.$$eval(
              '.application-draft-grid article',
              (items) => items.length
            ),
            1
          );
          await capture('public-page-two', publicReader);
          await go('/articles/page/2', publicReader);
          await text('Page 2', publicReader);
          assert.equal(
            await publicReader.$$eval(
              '.application-draft-grid article',
              (items) => items.length
            ),
            1
          );
          await go('/articles/Guides/page/1', publicReader);
          await text('20 articles', publicReader);
          await go('/articles?tag=offline', publicReader);
          await text('Published page article 20', publicReader);
          await text('1 articles', publicReader);
          await capture('tag-filter', publicReader);
          await fill('#article-search', 'article 21', publicReader);
          await fill('#article-tag-filter', '', publicReader);
          await click('Filter articles', publicReader);
          await text('Published page article 21', publicReader);
          await text('1 articles', publicReader);
          await go('/articles?page=3', publicReader);
          await text('No published articles found', publicReader);
          await capture('public-page-beyond', publicReader);
          await go('/my/articles/new', author);
          for (const key of ['title', 'slug', 'excerpt', 'byline', 'category'])
            await fill(
              '#article-' + key,
              key === 'slug' ? 'browser-account-switch' : fields[key],
              author
            );
          await fill(
            '#article-paragraph-0-0',
            'Private text before an account change.',
            author
          );
          loseResponse(
            (route, method) => route === '/api/me/articles' && method === 'POST'
          );
          await click('Save article draft', author);
          await text('Retry unconfirmed change', author);
          await author.evaluate(() => {
            localStorage.setItem('_i', 'draft-bob');
            window.dispatchEvent(
              new StorageEvent('storage', {
                key: '_i',
                newValue: 'draft-bob',
                storageArea: localStorage,
              })
            );
          });
          await author.waitForFunction(
            () => document.querySelector('#article-title')?.value === ''
          );
          assert(
            !(
              await author.$eval(
                'app-article-workspace',
                (el) => el.textContent
              )
            ).includes('Retry unconfirmed change')
          );
          assert.deepEqual(
            await json('GET', 'me/articles', undefined, 'DraftBrowserBob'),
            []
          );
          await capture('account-switch', author);
          return [
            'account-owned drafts, typed tags, exact create retry across navigation and independent-session persistence',
            'frozen submissions, independent denial/rejection/approval and identical lost-response retries',
            'current public article list/detail/filters/pagination with projection lag and truthful outage recovery',
            'real canonical account favorites, lost response retry, account isolation, restart persistence and withdrawn-reference removal',
            'private edit conflicts preserve unsaved fields and never alter approved public text',
            'withdrawal immediately hides stale projections; subsequent private deletion retains the URL tombstone',
            'keyboard form navigation and account-switch isolation discard private fields and old retry intent',
          ];
        },
      });
    },
  });
}
module.exports = { articlePublicationBrowser };
