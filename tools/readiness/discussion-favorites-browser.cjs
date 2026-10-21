const assert = require('node:assert/strict');

async function discussionFavoritesBrowser(options) {
  const { application, discussion, accepted, waitThread, favorites } = options;
  const actor = {
    identityId: 'DraftBrowserAlice',
    tenantId: 'default',
    roles: [],
  };
  const base = `application-discussions/${application.id}`;
  const content = {
    title: 'Keep this community conversation',
    displayName: 'Public Alice',
    text: 'A saved topic shared across independent sessions.',
    tags: ['community'],
  };
  const topic = accepted(await discussion('POST', base, content, actor), 201);
  await waitThread(application.id, topic.id, 1);
  const list = `/apps/${application.slug}/discussions`;
  const detail = `${list}/${topic.id}`;
  const host = 'discussion-quick-api-dialog';
  await require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    workflowOnly: true,
    commentWorkflow: async ({
      session,
      go,
      text,
      click,
      capture,
      commands,
      loseResponse,
      setOffline,
    }) => {
      const alice = await session('draft-alice');
      const independent = await session('draft-alice');
      const bob = await session('draft-bob');
      const reader = await session('');
      const favorite = 'favorite-toggle-button .favorite-toggle';
      async function membership(page, saved, scope = '') {
        await page.waitForFunction(
          (selector, saved) => {
            const button = document.querySelector(selector);
            return (
              button &&
              !button.disabled &&
              button.getAttribute('aria-pressed') === String(saved)
            );
          },
          {},
          `${scope} ${favorite}`,
          saved
        );
      }
      async function toggle(page, saved, scope = '') {
        await membership(page, saved, scope);
        await page.click(`${scope} ${favorite}`);
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
      async function noSavedLink(page) {
        assert.equal(
          await page.$('favorites-page .favorites-page__target a'),
          null
        );
      }
      async function savedLink(page, title) {
        await text(title, page);
        assert.equal(
          await page.$eval('favorites-page .favorites-page__target a', (link) =>
            link.getAttribute('href')
          ),
          detail
        );
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
          const bounds = dialog.getBoundingClientRect();
          const body = dialog.querySelector('.discussion-body');
          const button = dialog.querySelector('favorite-toggle-button button');
          button.scrollIntoView({ block: 'center', behavior: 'instant' });
          const control = button.getBoundingClientRect();
          const viewport = body.getBoundingClientRect();
          return {
            withinViewport:
              bounds.left >= -1 &&
              bounds.right <= innerWidth + 1 &&
              bounds.top >= -1 &&
              bounds.bottom <= innerHeight + 1,
            horizontalOverflow: body.scrollWidth > body.clientWidth + 1,
            favoriteReachable:
              control.top >= viewport.top - 1 &&
              control.bottom <= viewport.bottom + 1,
          };
        });
        assert.equal(modal.withinViewport, true);
        assert.equal(modal.horizontalOverflow, false);
        assert.equal(modal.favoriteReachable, true);
        return { modal };
      }

      await go(detail, reader);
      await text(content.text, reader);
      assert.equal(
        await reader.$eval(favorite, (button) => button.disabled),
        true
      );
      await capture('discussion-favorite-anonymous', reader);
      await go(detail, alice);
      await membership(alice, false);
      await go(detail, independent);
      await membership(independent, false);
      const requests = [];
      alice.on('request', (request) => {
        if (
          request.url().endsWith('/api/me/favorites') &&
          request.method() === 'PUT'
        )
          requests.push(JSON.parse(request.postData()));
      });
      loseResponse((route) => route === '/api/me/favorites');
      await toggle(alice, false);
      await text(
        'Could not confirm the change. Retry to confirm the same request.',
        alice
      );
      await membership(alice, false);
      const first = commands.at(-1);
      const committed = await favorites.read(actor.identityId);
      assert.equal(committed.favorites.length, 1);
      assert.equal(committed.favorites[0].kind, 'discussions');
      assert.equal(committed.favorites[0].id, topic.id);
      assert.ok(Number.isSafeInteger(committed.favorites[0].addedAt));
      assert.ok(committed.favorites[0].addedAt > 0);
      assert.equal(committed.revision, 2);
      await capture('discussion-favorite-unconfirmed', alice);
      await toggle(alice, false);
      await membership(alice, true);
      assert.equal(commands.at(-1).key, first.key);
      assert.deepEqual(requests[1], requests[0]);
      assert.deepEqual(await favorites.read(actor.identityId), committed);
      await toggle(independent, false);
      await text(
        'Your account changed. Reload favorites before trying again.',
        independent
      );
      await membership(independent, false);
      await capture('discussion-favorite-conflict', independent);
      await click('Reload favorites', independent);
      await membership(independent, true);
      await go('/me/favorite', independent);
      await savedLink(independent, content.title);
      await capture('discussion-favorite-saved', independent);
      await go('/me/favorite', bob);
      await text('No favorites yet', bob);

      await go(list, alice);
      await text(content.title, alice);
      await alice.click('discussion-quick-button button');
      await alice.waitForSelector(host, { visible: true });
      await membership(alice, true, host);
      await toggle(alice, true, host);
      await membership(alice, false, host);
      await alice.focus(`${host} ${favorite}`);
      await alice.keyboard.press('Enter');
      await membership(alice, true, host);
      await capture('discussion-favorite-quick-modal', alice, inspectModal);
      await button(alice, 'Close discussion');
      await alice.waitForSelector(host, { hidden: true });
      await membership(alice, true);
      await options.restart();
      await click('Reload favorites', independent);
      await savedLink(independent, content.title);

      await options.stopWorker();
      const updated = { ...content, title: 'The updated saved conversation' };
      const edit = accepted(
        await discussion(
          'PUT',
          `${base}/${topic.id}`,
          { expectedRevision: 1, content: updated },
          actor
        )
      );
      await click('Reload favorites', independent);
      await text('Saved item details could not be loaded', independent);
      await text('Details unavailable', independent);
      await noSavedLink(independent);
      await capture('discussion-favorite-projection-pending', independent);
      options.startWorker();
      await waitThread(application.id, topic.id, edit.revision);
      await click('Reload favorites', independent);
      await savedLink(independent, updated.title);
      setOffline((pathname) => pathname === '/api/discussion-selection');
      await click('Reload favorites', independent);
      await text('Saved item details could not be loaded', independent);
      await noSavedLink(independent);
      await capture('discussion-favorite-details-outage', independent);
      await toggle(independent, true);
      await text('No favorites yet', independent);
      setOffline(false);

      await go(detail, alice);
      await toggle(alice, false);
      await membership(alice, true);
      await options.withdraw();
      await click('Reload favorites', independent);
      await text('Unavailable discussion', independent);
      await noSavedLink(independent);
      await capture('discussion-favorite-withdrawn', independent);
      await toggle(independent, true);
      await text('No favorites yet', independent);
      await options.republish();
      await go(detail, alice);
      await membership(alice, false);
      loseResponse((route) => route === '/api/me/favorites');
      await toggle(alice, false);
      await text('Could not confirm the change.', alice);
      await switchSession(alice, 'draft-bob');
      await membership(alice, false);
      assert.equal(
        await alice.$('favorite-toggle-button [role="alert"]'),
        null
      );
      await capture('discussion-favorite-account-switch', alice);
      await switchSession(alice, null);
      await text('Sign in to start a discussion', alice);
      await text(content.text, alice);
      await alice.waitForSelector(favorite);
      assert.equal(
        await alice.$eval(favorite, (button) => button.disabled),
        true
      );
      assert.equal(
        await alice.$('favorite-toggle-button [role="alert"]'),
        null
      );
      await capture('discussion-favorite-signed-out', alice);
      await click('Reload favorites', bob);
      await text('No favorites yet', bob);
      await click('Reload favorites', independent);
      await savedLink(independent, updated.title);
      accepted(
        await discussion(
          'DELETE',
          `${base}/${topic.id}`,
          { expectedRevision: edit.revision },
          actor
        )
      );
      await click('Reload favorites', independent);
      await text('Unavailable discussion', independent);
      await noSavedLink(independent);
      await capture('discussion-favorite-deleted-topic', independent);
      await toggle(independent, true);
      await text('No favorites yet', independent);
      assert.deepEqual((await favorites.read(actor.identityId)).favorites, []);
      return [
        'Anonymous favorite controls disabled; canonical discussion list/detail and quick modal share account membership',
        'Lost committed response retries identical command/key once; stale independent session conflicts until reloaded',
        'Saved topics resolve current titles and canonical parent/thread links across API restart; another account remains empty',
        'Projection lag and metadata-only outage clear stale details and links; saved-reference removal stays usable',
        'Withdrawal and deletion produce unavailable removable references; republication restores eligible targets',
        'Account switch and signout clear private favorite feedback and membership',
      ];
    },
  });
}

module.exports = { discussionFavoritesBrowser };
