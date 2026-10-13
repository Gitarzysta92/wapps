const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');

async function articleCommentsBrowser(options) {
  const { article, discussion, accepted, waitThread } = options;
  const base = `article-comments/${article.id}`;
  const route = '/articles/' + article.slug;
  async function roots() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await discussion('GET', base, undefined, null);
      if (result.status === 200) return result.body;
      assert.equal(result.status, 503, JSON.stringify(result));
      await delay(100);
    }
    throw new Error('Public comment page did not materialize');
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
              .querySelector('article-comments section')
              ?.getAttribute('aria-busy') === 'false'
        );
      const enter = async (page, name, body) => {
        await fill('#article-comment-name', name, page);
        await fill('#article-comment-text', body, page);
      };
      async function action(page, content, label) {
        await page.waitForFunction(
          (content, label) =>
            [...document.querySelectorAll('.comment-entry')].some(
              (entry) =>
                entry.querySelector('.comment-text')?.textContent.trim() ===
                  content &&
                [...entry.querySelectorAll('button')].some(
                  (button) =>
                    button.textContent.trim() === label && !button.disabled
                )
            ),
          {},
          content,
          label
        );
        await page.evaluate(
          (content, label) => {
            const entry = [...document.querySelectorAll('.comment-entry')].find(
              (entry) =>
                entry.querySelector('.comment-text')?.textContent.trim() ===
                content
            );
            [...entry.querySelectorAll('button')]
              .find(
                (button) =>
                  button.textContent.trim() === label && !button.disabled
              )
              .click();
          },
          content,
          label
        );
      }
      async function reload(page, value) {
        await click('Reload comments', page);
        await idle(page);
        if (value) await text(value, page);
      }
      await go(route, reader);
      await text('No comments yet.', reader);
      assert.equal(await reader.$('#article-comment-text'), null);
      await capture('comments-public-empty', reader);
      await go(route, alice);
      await text('Join the conversation', alice);
      await capture('comments-member-empty', alice);

      await options.stopWorker();
      await enter(alice, 'Public Alice', 'An independent community comment.');
      await click('Post comment', alice);
      await text('Comment change saved.', alice);
      await text('Comments are unavailable or still updating.', alice);
      await capture('comments-accepted-projection-pending', alice);
      options.startWorker();
      const firstPage = await roots();
      assert.equal(firstPage.items.length, 1);
      const rootId = firstPage.items[0].id;
      await reload(alice, 'An independent community comment.');
      await go(route, bob);
      await text('An independent community comment.', bob);
      assert.deepEqual(
        await bob.$$eval('.comment-entry button', (buttons) =>
          buttons.map((button) => button.textContent.trim())
        ),
        ['Reply']
      );
      await action(bob, 'An independent community comment.', 'Reply');
      await enter(bob, 'Public Bob', 'A reply from a second member.');
      await click('Post reply', bob);
      await text('Comment change saved.', bob);
      await waitThread(article.id, rootId, 2);
      await reload(reader);
      await click('Read replies (1)', reader);
      await text('A reply from a second member.', reader);
      assert.equal(
        await reader.$$eval(
          '.comment-entry button',
          (buttons) => buttons.length
        ),
        0
      );
      await capture('comments-public-thread', reader);

      await go(route, independent);
      await text('An independent community comment.', independent);
      await reload(alice);
      await action(alice, 'An independent community comment.', 'Edit comment');
      await fill(
        '#article-comment-text',
        'The author revised this comment.',
        alice
      );
      await click('Save comment', alice);
      await waitThread(article.id, rootId, 3);
      await action(
        independent,
        'An independent community comment.',
        'Edit comment'
      );
      await fill(
        '#article-comment-text',
        'My text survives a conflict.',
        independent
      );
      await click('Save comment', independent);
      await text('The thread changed.', independent);
      assert.equal(
        await independent.$eval(
          '#article-comment-text',
          (element) => element.value
        ),
        'My text survives a conflict.'
      );
      await capture('comments-edit-conflict', independent);
      await reload(independent, 'The author revised this comment.');
      await action(
        independent,
        'The author revised this comment.',
        'Edit comment'
      );
      await fill(
        '#article-comment-text',
        'The author explicitly resolved the conflict.',
        independent
      );
      await click('Save comment', independent);
      await waitThread(article.id, rootId, 4);
      await reload(independent, 'The author explicitly resolved the conflict.');

      const originalCount = commands.length;
      loseResponse(
        (url, method) => url === '/api/' + base && method === 'POST'
      );
      await enter(
        alice,
        'Public Alice',
        'This exact comment is retried after navigation.'
      );
      await click('Post comment', alice);
      await text('The comment change could not be confirmed.', alice);
      const original = commands
        .slice(originalCount)
        .find((command) => command.method === 'POST');
      assert.ok(original);
      await capture('comments-unconfirmed-request', alice);
      await alice.$eval('a[href="/articles"]', (link) => link.click());
      await text('Filter articles', alice);
      await alice.waitForFunction(
        (route) =>
          [...document.querySelectorAll('a')].some(
            (link) =>
              link.getAttribute('href') === route &&
              link.textContent.trim() === 'Read article'
          ),
        {},
        route
      );
      await alice.evaluate(
        (route) =>
          [...document.querySelectorAll('a')]
            .find(
              (link) =>
                link.getAttribute('href') === route &&
                link.textContent.trim() === 'Read article'
            )
            .click(),
        route
      );
      await text('Resolve the last comment request', alice);
      await click('Retry last comment request', alice);
      await text('Comment change saved.', alice);
      assert.equal(
        commands.filter((command) => command.key === original.key).length,
        2
      );
      let page = await roots();
      assert.equal(
        page.items.filter(
          (item) =>
            item.comments[0].content.text ===
            'This exact comment is retried after navigation.'
        ).length,
        1
      );

      loseResponse(
        (url, method) => url === '/api/' + base && method === 'POST'
      );
      await enter(
        alice,
        'Public Alice',
        'A committed comment before the account switch.'
      );
      await click('Post comment', alice);
      await text('The comment change could not be confirmed.', alice);
      await text('Resolve the last comment request', alice);
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
          document.querySelector('#article-comment-text')?.value === '' &&
          !document
            .querySelector('article-comments')
            ?.textContent.includes('Resolve the last comment request')
      );
      assert.equal(commands.length, beforeSwitch);
      assert.deepEqual(
        await alice.$$eval('.comment-entry button', (buttons) =>
          buttons.filter(
            (button) => button.textContent.trim() === 'Edit comment'
          )
        ),
        []
      );
      await capture('comments-account-switch', alice);

      await go(route, moderator);
      await text('Read replies (1)', moderator);
      await click('Read replies (1)', moderator);
      await text('A reply from a second member.', moderator);
      assert.equal(
        await moderator.$$eval(
          '.comment-entry button',
          (buttons) =>
            buttons.filter(
              (button) => button.textContent.trim() === 'Edit comment'
            ).length
        ),
        0
      );
      await action(
        moderator,
        'A reply from a second member.',
        'Remove comment'
      );
      await capture('comments-moderator-confirmation', moderator);
      await click('Confirm removal', moderator);
      await waitThread(article.id, rootId, 5);
      await reload(reader);
      await click('Read replies (1)', reader);
      await text('Comment removed. Replies remain', reader);
      assert.equal(
        await reader.$$eval('.comment-text', (elements) =>
          elements.some((element) =>
            element.textContent.includes('A reply from a second member.')
          )
        ),
        false
      );
      await capture('comments-redacted-reply', reader);
      await go(route, independent);
      await text('The author explicitly resolved the conflict.', independent);
      await action(
        independent,
        'The author explicitly resolved the conflict.',
        'Remove comment'
      );
      await text('Remove this thread and all its replies?', independent);
      await click('Confirm removal', independent);
      await idle(independent);
      await roots();
      await reload(reader);
      assert.equal(
        await reader.$$eval('.comment-text', (elements) =>
          elements.some((element) =>
            element.textContent.includes(
              'The author explicitly resolved the conflict.'
            )
          )
        ),
        false
      );

      for (let index = 0; index < 10; index++) {
        const added = accepted(
          await discussion('POST', base, {
            displayName: 'Page reader',
            text: `Pagination comment ${index}`,
          }),
          201
        );
        await waitThread(article.id, added.id, 1);
      }
      await reload(reader, 'Older comments');
      const newest = await reader.$$eval('.comment-text', (elements) =>
        elements.map((element) => element.textContent)
      );
      assert.equal(newest.length, 10);
      await capture('comments-first-page', reader);
      await click('Older comments', reader);
      await idle(reader);
      const older = await reader.$$eval('.comment-text', (elements) =>
        elements.map((element) => element.textContent)
      );
      assert.equal(older.length, 2);
      assert.equal(new Set([...newest, ...older]).size, 12);
      await capture('comments-older-page', reader);
      await click('Latest comments', reader);
      await idle(reader);
      assert.deepEqual(
        await reader.$$eval('.comment-text', (elements) =>
          elements.map((element) => element.textContent)
        ),
        newest
      );

      setOffline(true);
      await reload(reader, 'Comments are unavailable');
      assert.equal(
        await reader.$$eval('.comment-text', (elements) => elements.length),
        0
      );
      await capture('comments-unavailable', reader);
      setOffline(false);
      await options.restart();
      await reload(reader, 'Pagination comment 9');
      await options.withdraw();
      await reload(reader, 'The article or comment is no longer available.');
      assert.equal(
        await reader.$$eval('.comment-text', (elements) => elements.length),
        0
      );
      await capture('comments-withdrawn-parent', reader);
      await options.republish();
      await reload(reader, 'Pagination comment 9');
      page = await roots();
      assert.equal(page.items.length, 10);
      return [
        'Anonymous reading and two independent ordinary members with explicit public names',
        'Durable post receipt separated from unavailable projection until actual broker delivery',
        'Reply expansion, owner edits, stale conflict with preserved text and explicit revision refresh',
        'Lost committed receipt and identical retry across client-side navigation without duplicate comments',
        'Account switch clears private pending intent and form fields without replay',
        'Moderator removal without edit authority, public redacted reply and owner root removal',
        'Bounded root pagination with distinct latest/older pages',
        'Truthful outage, Discussion restart persistence and withdrawn/republished parent visibility',
      ];
    },
  });
}

module.exports = { articleCommentsBrowser };
