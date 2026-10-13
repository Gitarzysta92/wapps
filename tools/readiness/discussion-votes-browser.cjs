const assert = require('node:assert/strict');

async function discussionVotesBrowser(options) {
  const { application, discussion, accepted, waitThread } = options;
  const aliceActor = {
    identityId: 'DraftBrowserAlice',
    tenantId: 'default',
    roles: [],
  };
  const bobActor = { ...aliceActor, identityId: 'DraftBrowserBob' };
  const base = `application-discussions/${application.id}`;
  const topic = accepted(
    await discussion(
      'POST',
      base,
      {
        title: 'A conversation with real votes',
        displayName: 'Public Alice',
        text: 'A topic with one durable choice per member.',
        tags: ['community'],
      },
      aliceActor
    ),
    201
  );
  const reply = accepted(
    await discussion(
      'POST',
      `${base}/${topic.id}/replies`,
      {
        displayName: 'Public Bob',
        text: 'A reply with its own votes.',
      },
      bobActor
    ),
    201
  );
  await waitThread(application.id, topic.id, reply.revision);
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
      const alice = await session('draft-alice'),
        independent = await session('draft-alice');
      const bob = await session('draft-bob'),
        reader = await session('');
      const entry = (id = topic.id, scope = '') =>
        `${scope} [data-post-id="${id}"] [aria-label="Post votes"]`;
      async function counts(
        page,
        up,
        down,
        mine,
        id = topic.id,
        scope = '',
        disabled = false
      ) {
        await page.waitForFunction(
          (selector, up, down, mine, disabled) => {
            const buttons = [
              ...document.querySelectorAll(`${selector} button`),
            ];
            return (
              buttons.length === 2 &&
              buttons[0].textContent.trim() === `Upvote (${up})` &&
              buttons[1].textContent.trim() === `Downvote (${down})` &&
              buttons[0].getAttribute('aria-pressed') === String(mine === 1) &&
              buttons[1].getAttribute('aria-pressed') === String(mine === -1) &&
              buttons.every((button) => button.disabled === disabled)
            );
          },
          {},
          entry(id, scope),
          up,
          down,
          mine,
          disabled
        );
      }
      async function choose(page, direction, id = topic.id, scope = '') {
        const selector = `${entry(id, scope)} button:nth-child(${
          direction === 1 ? 1 : 2
        })`;
        await page.waitForSelector(selector + ':not([disabled])');
        await page.click(selector);
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
          const control = dialog.querySelector('[aria-label="Post votes"]');
          control.scrollIntoView({ block: 'center', behavior: 'instant' });
          const votes = control.getBoundingClientRect(),
            viewport = scroll.getBoundingClientRect();
          return {
            withinViewport:
              bounds.left >= -1 &&
              bounds.right <= innerWidth + 1 &&
              bounds.top >= -1 &&
              bounds.bottom <= innerHeight + 1,
            horizontalOverflow: scroll.scrollWidth > scroll.clientWidth + 1,
            votesReachable:
              votes.top >= viewport.top - 1 &&
              votes.bottom <= viewport.bottom + 1,
          };
        });
        assert.equal(modal.withinViewport, true);
        assert.equal(modal.horizontalOverflow, false);
        assert.equal(modal.votesReachable, true);
        return { modal };
      }

      await go(detail, reader);
      await counts(reader, 0, 0, 0, topic.id, '', true);
      await capture('discussion-vote-anonymous', reader);
      await go(detail, alice);
      await go(detail, independent);
      await counts(alice, 0, 0, 0);
      await counts(independent, 0, 0, 0);
      const requests = [];
      alice.on('request', (request) => {
        if (request.method() === 'PUT' && request.url().endsWith('/vote'))
          requests.push(JSON.parse(request.postData()));
      });
      await fill(
        '#application-discussion-text',
        'An unfinished reply stays here.',
        alice
      );
      loseResponse((url) => url.endsWith('/vote'));
      await choose(alice, 1);
      await text('Resolve the last discussion request', alice);
      const first = commands.at(-1);
      await capture('discussion-vote-unconfirmed', alice);
      await click('Retry last discussion request', alice);
      await text('Discussion change saved.', alice);
      assert.equal(commands.at(-1).key, first.key);
      assert.deepEqual(requests[1], requests[0]);
      await refresh(alice, 3);
      await counts(alice, 1, 0, 1);
      assert.equal(
        await alice.$eval(
          '#application-discussion-text',
          (field) => field.value
        ),
        'An unfinished reply stays here.'
      );
      await choose(independent, -1);
      await text(
        'The thread changed. Reload the discussion before voting again.',
        independent
      );
      await counts(independent, 0, 0, 0);
      await capture('discussion-vote-conflict', independent);
      await refresh(independent, 3);
      await counts(independent, 1, 0, 1);
      await choose(independent, -1);
      await text('Discussion change saved.', independent);
      await refresh(independent, 4);
      await counts(independent, 0, 1, -1);
      await go(detail, bob);
      await counts(bob, 0, 1, 0);
      await choose(bob, 1);
      await text('Discussion change saved.', bob);
      await refresh(bob, 5);
      await counts(bob, 1, 1, 1);
      await choose(bob, -1, reply.id);
      await text('Discussion change saved.', bob);
      await refresh(bob, 6);
      await counts(bob, 0, 1, -1, reply.id);
      await capture('discussion-vote-member-reply', bob);

      await go(list, alice);
      await alice.click('discussion-quick-button button');
      await alice.waitForSelector(host, { visible: true });
      await counts(alice, 1, 1, -1, topic.id, host);
      await choose(alice, -1, topic.id, host);
      await projected(7);
      await button(alice, 'Reload discussions');
      await counts(alice, 1, 0, 0, topic.id, host);
      await alice.focus(`${entry(topic.id, host)} button:first-child`);
      await alice.keyboard.press('Enter');
      await projected(8);
      await button(alice, 'Reload discussions');
      await counts(alice, 2, 0, 1, topic.id, host);
      await capture('discussion-vote-quick-modal', alice, inspectModal);
      await button(alice, 'Close discussion');
      await alice.waitForSelector(host, { hidden: true });
      await counts(alice, 2, 0, 1);
      await capture('discussion-vote-topic-list', alice);
      await options.restart();
      await go(detail, alice);
      await counts(alice, 2, 0, 1);
      await options.stopWorker();
      await choose(alice, 1);
      await text('Discussion change saved.', alice);
      await text('Discussions are unavailable or still updating.', alice);
      assert.equal(await alice.$('[aria-label="Post votes"]'), null);
      await capture('discussion-vote-projection-pending', alice);
      options.startWorker();
      await refresh(alice, 9);
      await counts(alice, 1, 0, 0);
      setOffline((pathname) =>
        pathname.startsWith('/api/application-discussions/')
      );
      await click('Reload discussions', alice);
      await text('Discussions are unavailable or still updating.', alice);
      assert.equal(await alice.$('[aria-label="Post votes"]'), null);
      await capture('discussion-vote-unavailable', alice);
      setOffline(false);
      await refresh(alice, 9);
      loseResponse((url) => url.endsWith('/vote'));
      await choose(alice, -1);
      await text('Resolve the last discussion request', alice);
      await projected(10);
      await switchSession(alice, 'draft-bob');
      await counts(alice, 1, 1, 1);
      assert.equal(
        await alice.$eval('application-discussions', (view) =>
          view.textContent.includes('Resolve the last discussion request')
        ),
        false
      );
      assert.equal(
        await alice.$eval(
          '#application-discussion-text',
          (field) => field.value
        ),
        ''
      );
      await capture('discussion-vote-account-switch', alice);
      await switchSession(alice, null);
      await counts(alice, 1, 1, 0, topic.id, '', true);
      await capture('discussion-vote-signed-out', alice);
      await options.withdraw();
      await click('Reload discussions', bob);
      await text('The application or discussion is no longer available.', bob);
      assert.equal(await bob.$('[aria-label="Post votes"]'), null);
      await capture('discussion-vote-withdrawn', bob);
      await options.republish();
      await refresh(bob, 10);
      await counts(bob, 1, 1, 1);
      accepted(
        await discussion(
          'DELETE',
          `${base}/${topic.id}`,
          { expectedRevision: 10 },
          aliceActor
        )
      );
      await click('Reload discussions', bob);
      await text('The application or discussion is no longer available.', bob);
      assert.equal(await bob.$('[aria-label="Post votes"]'), null);
      await capture('discussion-vote-deleted-topic', bob);
      return [
        'Anonymous totals expose no voter identities or active mutation controls; independent members retain their own choice',
        'Exact lost-response retry does not double-count; stale sessions conflict, and successful votes preserve unfinished reply text',
        'Upvote/downvote switching and removal work on roots/replies and quick dialogs; keyboard vote persists and closing refreshes the list',
        'Votes survive API restart; projection lag and service outages clear stale posts/counters and recover on reload',
        'Account switching clears private membership and retry intent; signout exposes only public counts',
        'Parent withdrawal and topic deletion remove vote controls and stale content',
      ];
    },
  });
}

module.exports = { discussionVotesBrowser };
