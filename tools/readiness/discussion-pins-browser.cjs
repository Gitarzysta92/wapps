const assert = require('node:assert/strict');

async function discussionPinsBrowser(options) {
  const { application, discussion, accepted, waitThread } = options;
  const author = {
    identityId: 'DraftBrowserAlice',
    tenantId: 'default',
    roles: [],
  };
  const base = `application-discussions/${application.id}`;
  const topic = accepted(
    await discussion(
      'POST',
      base,
      {
        title: 'A topic moderators can pin',
        displayName: 'Public author',
        text: 'Pinning changes discovery, while this conversation remains intact.',
        tags: ['community'],
      },
      author
    ),
    201
  );
  const newer = accepted(
    await discussion(
      'POST',
      base,
      {
        title: 'A newer ordinary topic',
        displayName: 'Public author',
        text: 'An unpinned topic appears after pinned conversations.',
        tags: [],
      },
      author
    ),
    201
  );
  await waitThread(application.id, topic.id, 1);
  await waitThread(application.id, newer.id, 1);
  const list = `/apps/${application.slug}/discussions`,
    detail = `${list}/${topic.id}`;
  const host = 'discussion-quick-api-dialog';
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
      const moderator = await session('comment-moderator');
      const independent = await session('comment-moderator');
      const member = await session('draft-alice');
      const reader = await session('');
      async function state(
        page,
        pinned,
        canPin,
        scope = 'application-discussions'
      ) {
        await page.waitForFunction(
          (scope, pinned, canPin) => {
            const root = document.querySelector(scope);
            if (
              !root ||
              (!root.matches('[aria-label="Discussion topic"]') &&
                !root.querySelector('[aria-label="Discussion topic"]'))
            )
              return false;
            const controls = [...root.querySelectorAll('button')].filter(
              (button) =>
                ['Pin topic', 'Unpin topic'].includes(button.textContent.trim())
            );
            return (
              !!root.querySelector('[aria-label="Pinned topic"]') === pinned &&
              controls.length === (canPin ? 1 : 0) &&
              (!canPin ||
                (controls[0].textContent.trim() ===
                  (pinned ? 'Unpin topic' : 'Pin topic') &&
                  !controls[0].disabled))
            );
          },
          {},
          scope,
          pinned,
          canPin
        );
      }
      async function button(page, label, scope = host) {
        await page.waitForFunction(
          (scope, label) =>
            [...document.querySelectorAll(`${scope} button`)].some(
              (button) =>
                button.textContent.trim() === label && !button.disabled
            ),
          {},
          scope,
          label
        );
        await page.evaluate(
          (scope, label) =>
            [...document.querySelectorAll(`${scope} button`)]
              .find(
                (button) =>
                  button.textContent.trim() === label && !button.disabled
              )
              .click(),
          scope,
          label
        );
      }
      const projected = (revision) =>
        waitThread(application.id, topic.id, revision);
      async function refresh(page, revision) {
        await projected(revision);
        await click('Reload discussions', page);
      }
      async function switchSession(page, token) {
        await page.evaluate((token) => {
          if (token) localStorage.setItem('_i', token);
          else localStorage.removeItem('_i');
          window.dispatchEvent(
            new StorageEvent('storage', {
              key: '_i',
              newValue: token,
              storageArea: localStorage,
            })
          );
        }, token);
      }
      async function inspectModal(page) {
        const modal = await page.$eval(host, (dialog) => {
          const bounds = dialog.getBoundingClientRect(),
            scroll = dialog.querySelector('.discussion-body');
          const control = [...dialog.querySelectorAll('button')].find(
            (button) =>
              ['Pin topic', 'Unpin topic'].includes(button.textContent.trim())
          );
          control.scrollIntoView({ block: 'center', behavior: 'instant' });
          const button = control.getBoundingClientRect(),
            viewport = scroll.getBoundingClientRect();
          return {
            withinViewport:
              bounds.left >= -1 &&
              bounds.right <= innerWidth + 1 &&
              bounds.top >= -1 &&
              bounds.bottom <= innerHeight + 1,
            horizontalOverflow: scroll.scrollWidth > scroll.clientWidth + 1,
            pinReachable:
              button.top >= viewport.top - 1 &&
              button.bottom <= viewport.bottom + 1,
          };
        });
        assert.equal(modal.withinViewport, true);
        assert.equal(modal.horizontalOverflow, false);
        assert.equal(modal.pinReachable, true);
        return { modal };
      }
      const card = `[aria-label="Discussion topic"]:has([data-post-id="${topic.id}"])`;
      const listOrder = async (page) =>
        page.$$eval(
          'application-discussions [aria-label="Discussion topic"] [data-post-id]',
          (posts) => posts.map((post) => post.getAttribute('data-post-id'))
        );
      await go(detail, reader);
      await state(reader, false, false);
      await capture('discussion-pin-anonymous', reader);
      await go(detail, member);
      await state(member, false, false);
      await capture('discussion-pin-member', member);
      await go(detail, moderator);
      await go(detail, independent);
      await state(moderator, false, true);
      await state(independent, false, true);
      const requests = [];
      moderator.on('request', (request) => {
        if (request.method() === 'PUT' && request.url().endsWith('/pin'))
          requests.push(JSON.parse(request.postData()));
      });
      await fill(
        '#application-discussion-text',
        'An unfinished moderator reply.',
        moderator
      );
      loseResponse((url) => url.endsWith('/pin'));
      await click('Pin topic', moderator);
      await text('Resolve the last discussion request', moderator);
      const first = commands.at(-1);
      await capture('discussion-pin-unconfirmed', moderator);
      await click('Retry last discussion request', moderator);
      await text('Discussion change saved.', moderator);
      assert.equal(commands.at(-1).key, first.key);
      assert.deepEqual(requests[1], requests[0]);
      await refresh(moderator, 2);
      await state(moderator, true, true);
      assert.equal(
        await moderator.$eval(
          '#application-discussion-text',
          (field) => field.value
        ),
        'An unfinished moderator reply.'
      );
      await capture('discussion-pin-pinned', moderator);
      await click('Pin topic', independent);
      await text(
        'The thread changed. Reload the discussion before pinning again.',
        independent
      );
      await capture('discussion-pin-conflict', independent);
      await refresh(independent, 2);
      await state(independent, true, true);
      await click('Unpin topic', independent);
      await text('Discussion change saved.', independent);
      await refresh(independent, 3);
      await state(independent, false, true);
      await go(list, moderator);
      await moderator.waitForSelector(`${card} discussion-quick-button button`);
      await moderator.click(`${card} discussion-quick-button button`);
      await moderator.waitForSelector(host, { visible: true });
      await state(moderator, false, true, host);
      await button(moderator, 'Pin topic');
      await projected(4);
      await button(moderator, 'Reload discussions');
      await state(moderator, true, true, host);
      await moderator.evaluate(
        (host) =>
          [...document.querySelectorAll(`${host} button`)]
            .find((button) => button.textContent.trim() === 'Unpin topic')
            .focus(),
        host
      );
      await moderator.keyboard.press('Enter');
      await projected(5);
      await button(moderator, 'Reload discussions');
      await state(moderator, false, true, host);
      await capture('discussion-pin-quick-modal', moderator, inspectModal);
      await button(moderator, 'Close discussion');
      await moderator.waitForSelector(host, { hidden: true });
      await state(moderator, false, true, card);
      assert.deepEqual(await listOrder(moderator), [newer.id, topic.id]);
      await button(moderator, 'Pin topic', card);
      await text('Discussion change saved.', moderator);
      await refresh(moderator, 6);
      await state(moderator, true, true, card);
      assert.deepEqual(await listOrder(moderator), [topic.id, newer.id]);
      await capture('discussion-pin-ordered-list', moderator);
      await options.restart();
      await go(detail, moderator);
      await state(moderator, true, true);
      await options.stopWorker();
      await click('Unpin topic', moderator);
      await text('Discussion change saved.', moderator);
      await text('Discussions are unavailable or still updating.', moderator);
      assert.equal(await moderator.$('[aria-label="Pinned topic"]'), null);
      await capture('discussion-pin-projection-pending', moderator);
      options.startWorker();
      await refresh(moderator, 7);
      await state(moderator, false, true);
      setOffline((pathname) =>
        pathname.startsWith('/api/application-discussions/')
      );
      await click('Reload discussions', moderator);
      await text('Discussions are unavailable or still updating.', moderator);
      assert.equal(await moderator.$('[aria-label="Discussion topic"]'), null);
      await capture('discussion-pin-unavailable', moderator);
      setOffline(false);
      await refresh(moderator, 7);
      await state(moderator, false, true);
      loseResponse((url) => url.endsWith('/pin'));
      await click('Pin topic', moderator);
      await text('Resolve the last discussion request', moderator);
      await projected(8);
      await switchSession(moderator, 'draft-alice');
      await state(moderator, true, false);
      assert.equal(
        await moderator.$eval('application-discussions', (view) =>
          view.textContent.includes('Resolve the last discussion request')
        ),
        false
      );
      assert.equal(
        await moderator.$eval(
          '#application-discussion-text',
          (field) => field.value
        ),
        ''
      );
      await capture('discussion-pin-role-change', moderator);
      await switchSession(moderator, null);
      await state(moderator, true, false);
      await capture('discussion-pin-signed-out', moderator);
      await options.withdraw();
      await click('Reload discussions', member);
      await text(
        'The application or discussion is no longer available.',
        member
      );
      assert.equal(await member.$('[aria-label="Pinned topic"]'), null);
      await capture('discussion-pin-withdrawn', member);
      await options.republish();
      await refresh(member, 8);
      await state(member, true, false);
      accepted(
        await discussion(
          'DELETE',
          `${base}/${topic.id}`,
          { expectedRevision: 8 },
          author
        )
      );
      await click('Reload discussions', member);
      await text(
        'The application or discussion is no longer available.',
        member
      );
      assert.equal(await member.$('[aria-label="Pinned topic"]'), null);
      await capture('discussion-pin-deleted-topic', member);
      return [
        'Only tenant moderators see pin controls; members and anonymous readers see canonical public pin state',
        'Lost-response exact retry commits once and preserves unfinished reply text; independent stale moderator conflicts',
        'Quick-modal pin/unpin and keyboard activation persist, refresh the originating list and maintain bounded pin-first ordering',
        'Restart, projection lag and service outage recover with truthful states and no stale pin controls',
        'Role/session changes clear private retry intent and controls; withdrawal/deletion hide retained pin state',
      ];
    },
  });
}

module.exports = { discussionPinsBrowser };
