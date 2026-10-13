const assert = require('node:assert/strict');

async function myDiscussionsBrowser(options) {
  const { application, discussion, accepted, waitThread } = options;
  const base = `application-discussions/${application.id}`;
  const aliceActor = {
    identityId: 'DraftBrowserAlice',
    tenantId: 'default',
    roles: [],
  };
  const bobActor = { ...aliceActor, identityId: 'DraftBrowserBob' };
  const roots = [];
  const topic = (index) => ({
    displayName: 'Public Alice',
    title: `Account conversation ${index}`,
    text: `Durable application topic ${index}.`,
    tags: [],
  });
  for (let index = 0; index < 12; index++) {
    const result = accepted(
      await discussion('POST', base, topic(index), aliceActor),
      201
    );
    roots.push(result);
    await waitThread(application.id, result.id, 1);
  }
  await require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    workflowOnly: true,
    commentWorkflow: async ({
      session,
      go,
      text,
      click,
      capture,
      setOffline,
    }) => {
      const alice = await session('draft-alice'),
        independent = await session('draft-alice'),
        bob = await session('draft-bob');
      const route = '/me/discussions';
      const cards = (page) =>
        page.$$eval(
          'app-my-discussions-api-page ui-medium-card h2 a',
          (links) =>
            links.map((link) => ({
              title: link.textContent.trim(),
              href: link.getAttribute('href'),
            }))
        );
      const refresh = async (page) => {
        await click('Refresh latest', page);
        await page.waitForFunction(
          () =>
            document
              .querySelector('app-my-discussions-api-page section')
              ?.getAttribute('aria-busy') === 'false'
        );
      };
      await go(route, bob);
      await text('No visible discussions', bob);
      await capture('my-topics-empty', bob);
      await go(route, alice);
      await text('You started this topic', alice);
      const first = await cards(alice);
      assert.equal(first.length, 10);
      assert(
        first.every((item) =>
          item.href.startsWith(`/apps/${application.slug}/discussions/`)
        )
      );
      await capture('my-topics-author', alice);
      await go(route, independent);
      assert.deepEqual(await cards(independent), first);
      await click('Load more', alice);
      await text('Account conversation 0', alice);
      const second = await cards(alice);
      assert.equal(second.length, 2);
      assert.equal(
        new Set([...first, ...second].map((item) => item.href)).size,
        12
      );
      await capture('my-topics-older', alice);
      await refresh(alice);
      assert.deepEqual(await cards(alice), first);

      const replies = [];
      for (let index = 0; index < 2; index++) {
        const result = accepted(
          await discussion(
            'POST',
            `${base}/${roots[0].id}/replies`,
            { displayName: 'Public Bob', text: `Bob participated ${index}.` },
            bobActor
          ),
          201
        );
        replies.push(result);
        await waitThread(application.id, roots[0].id, result.revision);
      }
      await refresh(bob);
      await text('You replied', bob);
      assert.equal((await cards(bob)).length, 1);
      await capture('my-topics-participant', bob);
      await bob.click('app-my-discussions-api-page ui-medium-card h2 a');
      await text('Bob participated 1.', bob);
      assert.equal(
        new URL(bob.url()).pathname,
        `/apps/${application.slug}/discussions/${roots[0].id}`
      );
      await go(route, bob);
      await options.stopWorker();
      const edit = accepted(
        await discussion(
          'PUT',
          `${base}/${roots[0].id}`,
          {
            content: { ...topic(0), title: 'Updated account conversation' },
            expectedRevision: replies[1].revision,
          },
          aliceActor
        )
      );
      await refresh(bob);
      await text('unavailable or still updating', bob);
      assert.equal((await cards(bob)).length, 0);
      await capture('my-topics-projection-pending', bob);
      options.startWorker();
      await waitThread(application.id, roots[0].id, edit.revision);
      await click('Try again', bob);
      await text('Updated account conversation', bob);
      await options.restart();
      await refresh(bob);
      await text('Updated account conversation', bob);

      await independent.evaluate(() => {
        localStorage.setItem('_i', 'draft-bob');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: '_i',
            newValue: 'draft-bob',
            storageArea: localStorage,
          })
        );
      });
      await text('You replied', independent);
      assert.equal((await cards(independent)).length, 1);
      await capture('my-topics-account-switch', independent);
      setOffline(true);
      await refresh(bob);
      await text('Discussions could not be loaded', bob);
      assert.equal((await cards(bob)).length, 0);
      await capture('my-topics-unavailable', bob);
      setOffline(false);
      await click('Try again', bob);
      await text('Updated account conversation', bob);

      let revision = edit.revision;
      for (const reply of replies) {
        const removed = accepted(
          await discussion(
            'DELETE',
            `${base}/${reply.id}`,
            { expectedRevision: revision },
            bobActor
          )
        );
        revision = removed.revision;
        await waitThread(application.id, roots[0].id, revision);
      }
      await refresh(bob);
      await text('No visible discussions', bob);
      assert.equal((await cards(bob)).length, 0);
      await capture('my-topics-removed-participation', bob);
      await options.withdraw();
      await refresh(alice);
      await text('No visible topics on this page', alice);
      assert.equal((await cards(alice)).length, 0);
      await capture('my-topics-withdrawn-page', alice);
      await click('Load more', alice);
      await text('No visible topics on this page', alice);
      assert.equal((await cards(alice)).length, 0);
      assert.equal(
        await alice.$$eval(
          'app-my-discussions-api-page button',
          (buttons) =>
            buttons.filter(
              (button) => button.textContent.trim() === 'Load more'
            ).length
        ),
        0
      );
      await options.republish();
      await refresh(alice);
      assert.equal((await cards(alice)).length, 10);
      await independent.evaluate(() => {
        localStorage.removeItem('_i');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: '_i',
            newValue: null,
            storageArea: localStorage,
          })
        );
      });
      await text('Sign in to see your discussions', independent);
      assert.equal((await cards(independent)).length, 0);
      await capture('my-topics-signed-out', independent);
      return [
        'Canonical author and deduplicated reply participation with current catalog links',
        'Distinct keyset pages and independent same-account browser sessions',
        'Pending projection, API restart, outage and retry without stale cards',
        'Account switch/signout clears private listings; last-live-reply deletion revokes participation',
        'Withdrawal produces bounded empty continuation pages; republishing restores eligible topics',
      ];
    },
  });
}

module.exports = { myDiscussionsBrowser };
