const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');

async function applicationDiscussionsBrowser(options) {
  const { application, discussion, accepted, waitThread } = options;
  const base = `application-discussions/${application.id}`;
  const route = `/apps/${application.slug}/discussions`;
  const detail = (id) => `${route}/${id}`;
  async function roots() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await discussion('GET', base, undefined, null);
      if (result.status === 200) return result.body;
      assert.equal(result.status, 503, JSON.stringify(result));
      await delay(100);
    }
    throw new Error('Public discussion page did not materialize');
  }
  await require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    workflowOnly: true,
    commentWorkflow: async ({
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
      const alice = await session('draft-alice'),
        independent = await session('draft-alice');
      const bob = await session('draft-bob'),
        moderator = await session('comment-moderator'),
        reader = await session('');
      const idle = (page) =>
        page.waitForFunction(
          () =>
            document
              .querySelector('application-discussions section')
              ?.getAttribute('aria-busy') === 'false'
        );
      const enter = async (page, name, body, title) => {
        await fill('#application-discussion-name', name, page);
        await fill('#application-discussion-text', body, page);
        if (title !== undefined) {
          await fill('#application-discussion-title', title, page);
          await fill(
            '#application-discussion-tags',
            'community, privacy',
            page
          );
        }
      };
      const action = async (page, body, label) => {
        await page.waitForFunction(
          (body, label) =>
            [...document.querySelectorAll('.discussion-entry')].some(
              (entry) =>
                entry.querySelector('.discussion-text')?.textContent.trim() ===
                  body &&
                [...entry.querySelectorAll('button')].some(
                  (button) =>
                    button.textContent.trim() === label && !button.disabled
                )
            ),
          {},
          body,
          label
        );
        await page.evaluate(
          (body, label) => {
            const entry = [
              ...document.querySelectorAll('.discussion-entry'),
            ].find(
              (entry) =>
                entry.querySelector('.discussion-text')?.textContent.trim() ===
                body
            );
            [...entry.querySelectorAll('button')]
              .find(
                (button) =>
                  button.textContent.trim() === label && !button.disabled
              )
              .click();
          },
          body,
          label
        );
      };
      const reload = async (page, value) => {
        await click('Reload discussions', page);
        await idle(page);
        if (value) await text(value, page);
      };
      const navigate = async (page, href) => {
        await page.waitForFunction(
          (href) =>
            [
              ...document.querySelectorAll(
                'app-application-discussions-api-page a'
              ),
            ].some((link) => link.getAttribute('href') === href),
          {},
          href
        );
        await page.evaluate(
          (href) =>
            [
              ...document.querySelectorAll(
                'app-application-discussions-api-page a'
              ),
            ]
              .find((link) => link.getAttribute('href') === href)
              .click(),
          href
        );
        await idle(page);
      };
      await go(route, reader);
      await text('No discussions yet.', reader);
      assert.equal(await reader.$('#application-discussion-text'), null);
      await capture('topics-public-empty', reader);
      await go(route, alice);
      await text('Start a discussion', alice);
      await capture('topics-member-empty', alice);
      await options.stopWorker();
      await enter(
        alice,
        'Public Alice',
        'An independent community topic.',
        'A practical application question'
      );
      await click('Post discussion', alice);
      await text('Discussion change saved.', alice);
      await text('Discussions are unavailable or still updating.', alice);
      await capture('topics-accepted-pending', alice);
      options.startWorker();
      const first = await roots();
      assert.equal(first.items.length, 1);
      const rootId = first.items[0].id;
      assert.equal(first.items[0].title, 'A practical application question');
      assert.deepEqual(first.items[0].tags, ['community', 'privacy']);
      await reload(alice, 'An independent community topic.');
      await navigate(alice, detail(rootId));
      await text('Write a reply', alice);
      await go(detail(rootId), bob);
      await text('An independent community topic.', bob);
      assert.deepEqual(
        await bob.$$eval('.discussion-entry button', (buttons) =>
          buttons.map((button) => button.textContent.trim())
        ),
        ['Upvote (0)', 'Downvote (0)', 'Reply']
      );
      await enter(bob, 'Public Bob', 'A reply from a second member.');
      await click('Post reply', bob);
      await text('Discussion change saved.', bob);
      await waitThread(application.id, rootId, 2);
      await go(detail(rootId), reader);
      await text('A reply from a second member.', reader);
      assert.deepEqual(
        await reader.$$eval('.discussion-entry button', (buttons) =>
          buttons.map((button) => ({
            label: button.textContent.trim(),
            disabled: button.disabled,
          }))
        ),
        [
          { label: 'Upvote (0)', disabled: true },
          { label: 'Downvote (0)', disabled: true },
          { label: 'Upvote (0)', disabled: true },
          { label: 'Downvote (0)', disabled: true },
        ]
      );
      await capture('topics-public-thread', reader);
      await go(detail(rootId), independent);
      await text('An independent community topic.', independent);
      await reload(alice);
      await action(alice, 'An independent community topic.', 'Edit post');
      await fill('#application-discussion-title', 'An updated question', alice);
      await fill(
        '#application-discussion-text',
        'The author revised this topic.',
        alice
      );
      await click('Save post', alice);
      await waitThread(application.id, rootId, 3);
      await action(independent, 'An independent community topic.', 'Edit post');
      await fill(
        '#application-discussion-text',
        'My text survives a conflict.',
        independent
      );
      await click('Save post', independent);
      await text('The thread changed.', independent);
      assert.equal(
        await independent.$eval(
          '#application-discussion-text',
          (input) => input.value
        ),
        'My text survives a conflict.'
      );
      await capture('topics-edit-conflict', independent);
      await reload(independent, 'The author revised this topic.');
      await action(independent, 'The author revised this topic.', 'Edit post');
      await fill(
        '#application-discussion-text',
        'The author explicitly resolved the conflict.',
        independent
      );
      await click('Save post', independent);
      await waitThread(application.id, rootId, 4);
      await reload(independent, 'The author explicitly resolved the conflict.');

      await navigate(alice, route);
      await text('Start a discussion', alice);
      const originalCount = commands.length;
      loseResponse(
        (url, method) => url === '/api/' + base && method === 'POST'
      );
      await enter(
        alice,
        'Public Alice',
        'This exact topic is retried after navigation.',
        'Uncertain topic'
      );
      await click('Post discussion', alice);
      await text('Resolve the last discussion request', alice);
      await capture('topics-uncertain', alice);
      const original = commands[originalCount];
      await navigate(alice, detail(rootId));
      await text('Resolve the last discussion request', alice);
      await click('Retry last discussion request', alice);
      await text('Discussion change saved.', alice);
      assert.equal(
        commands.filter((command) => command.key === original.key).length,
        2
      );
      assert.equal(
        (await roots()).items.filter((item) => item.title === 'Uncertain topic')
          .length,
        1
      );

      await navigate(alice, route);
      loseResponse(
        (url, method) => url === '/api/' + base && method === 'POST'
      );
      await enter(
        alice,
        'Public Alice',
        'A committed post before account switch.',
        'Account switch topic'
      );
      await click('Post discussion', alice);
      await text('Resolve the last discussion request', alice);
      const beforeSwitch = commands.length;
      await alice.evaluate(() => {
        localStorage.setItem('_i', 'draft-bob');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: '_i',
            newValue: 'draft-bob',
            storageArea: localStorage,
          })
        );
      });
      await idle(alice);
      await alice.waitForFunction(
        () =>
          document.querySelector('#application-discussion-text')?.value ===
            '' &&
          !document
            .querySelector('application-discussions')
            ?.textContent.includes('Resolve the last discussion request')
      );
      assert.equal(commands.length, beforeSwitch);
      await capture('topics-account-switch', alice);

      await go(detail(rootId), moderator);
      await text('A reply from a second member.', moderator);
      assert.equal(
        await moderator.$$eval(
          '.discussion-entry button',
          (buttons) =>
            buttons.filter(
              (button) => button.textContent.trim() === 'Edit post'
            ).length
        ),
        0
      );
      await action(moderator, 'A reply from a second member.', 'Remove post');
      await capture('topics-moderator-confirmation', moderator);
      await click('Confirm removal', moderator);
      await waitThread(application.id, rootId, 5);
      await reload(reader, 'Post removed. Replies remain');
      assert.equal(
        await reader.$$eval('.discussion-text', (items) =>
          items.some((item) =>
            item.textContent.includes('A reply from a second member.')
          )
        ),
        false
      );
      await capture('topics-redacted-reply', reader);
      await reload(independent);
      await action(
        independent,
        'The author explicitly resolved the conflict.',
        'Remove post'
      );
      await text('Remove this topic and all its replies?', independent);
      await click('Confirm removal', independent);
      await text(
        'The application or discussion is no longer available.',
        independent
      );
      await reload(
        reader,
        'The application or discussion is no longer available.'
      );
      await capture('topics-removed-root', reader);

      for (let index = 0; index < 10; index++) {
        const added = accepted(
          await discussion('POST', base, {
            displayName: 'Page reader',
            title: `Pagination topic ${index}`,
            tags: [],
            text: `Pagination post ${index}`,
          }),
          201
        );
        await waitThread(application.id, added.id, 1);
      }
      await go(route, reader);
      await text('More discussions', reader);
      const newest = await reader.$$eval('.discussion-text', (elements) =>
        elements.map((element) => element.textContent)
      );
      assert.equal(newest.length, 10);
      await capture('topics-first-page', reader);
      await click('More discussions', reader);
      await idle(reader);
      const older = await reader.$$eval('.discussion-text', (elements) =>
        elements.map((element) => element.textContent)
      );
      assert.equal(older.length, 2);
      assert.equal(new Set([...newest, ...older]).size, 12);
      await capture('topics-older-page', reader);
      await click('Latest discussions', reader);
      await idle(reader);
      assert.deepEqual(
        await reader.$$eval('.discussion-text', (elements) =>
          elements.map((element) => element.textContent)
        ),
        newest
      );
      setOffline(true);
      await reload(reader, 'Discussions are unavailable');
      assert.equal(
        await reader.$$eval('.discussion-text', (elements) => elements.length),
        0
      );
      await capture('topics-unavailable', reader);
      setOffline(false);
      await options.restart();
      await reload(reader, 'Pagination post 9');
      await options.withdraw();
      await reload(
        reader,
        'The application or discussion is no longer available.'
      );
      assert.equal(
        await reader.$$eval('.discussion-text', (elements) => elements.length),
        0
      );
      await capture('topics-withdrawn-parent', reader);
      await options.republish();
      await reload(reader, 'Pagination post 9');
      return [
        'Canonical application UUID, public titles/tags and independent member posts/replies',
        'Broker-delayed projection distinguished from accepted writes',
        'Owner edits, retained conflict text and explicit revision selection',
        'Identical uncertain retry across list/detail navigation and account-switch isolation',
        'Moderator removal, redacted reply and hidden root without private identity disclosure',
        'Bounded pages, API restart, outage and canonical withdrawal/republishing',
      ];
    },
  });
}

module.exports = { applicationDiscussionsBrowser };
