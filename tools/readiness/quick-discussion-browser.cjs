const assert = require('node:assert/strict');

async function quickDiscussionBrowser(options) {
  const { application, discussion, accepted, waitThread } = options;
  const base = `application-discussions/${application.id}`;
  const route = `/apps/${application.slug}/discussions`;
  const aliceActor = {
    identityId: 'DraftBrowserAlice',
    tenantId: 'default',
    roles: [],
  };
  const initialText =
    'A real quick discussion. ' +
    'Members can read this long opening post and reach the reply composer. '.repeat(
      30
    );
  const root = accepted(
    await discussion(
      'POST',
      base,
      {
        title: 'Quick community conversation',
        displayName: 'Public Alice',
        tags: ['community'],
        text: initialText,
      },
      aliceActor
    ),
    201
  );
  await waitThread(application.id, root.id, 1);
  const host = 'discussion-quick-api-dialog';
  await require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    workflowOnly: true,
    preferencesFixture: (uid, defaults) => ({
      ...defaults,
      content: {
        ...defaults.content,
        showMatureContent: uid === 'DraftBrowserBob',
      },
    }),
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
      const alice = await session('draft-alice');
      const independent = await session('draft-alice');
      const bob = await session('draft-bob');
      const moderator = await session('comment-moderator');
      const reader = await session('');
      const modalText = (page, value) =>
        page.waitForFunction(
          (host, value) =>
            document.querySelector(host)?.textContent.includes(value),
          {},
          host,
          value
        );
      const idle = (page) =>
        page.waitForFunction(
          (host) =>
            document
              .querySelector(`${host} .discussion-body`)
              ?.getAttribute('aria-busy') === 'false',
          {},
          host
        );
      async function button(page, label, selector = host) {
        await page.waitForFunction(
          (selector, label) =>
            [...document.querySelectorAll(`${selector} button`)].some(
              (button) =>
                button.textContent.trim() === label && !button.disabled
            ),
          {},
          selector,
          label
        );
        await page.evaluate(
          (selector, label) =>
            [...document.querySelectorAll(`${selector} button`)]
              .find(
                (button) =>
                  button.textContent.trim() === label && !button.disabled
              )
              .click(),
          selector,
          label
        );
      }
      async function open(page) {
        await page.waitForSelector(
          'discussion-quick-button button:not([disabled])'
        );
        await page.click('discussion-quick-button button');
        await page.waitForSelector(host, { visible: true });
        await idle(page);
      }
      async function close(page) {
        await button(page, 'Close discussion');
        await page.waitForSelector(host, { hidden: true });
      }
      async function reload(page, value) {
        await button(page, 'Reload discussions');
        await idle(page);
        if (value) await modalText(page, value);
      }
      async function action(page, body, label) {
        const selector = `${host} .discussion-entry`;
        await page.waitForFunction(
          (selector, body, label) =>
            [...document.querySelectorAll(selector)].some(
              (entry) =>
                entry.querySelector('.discussion-text')?.textContent.trim() ===
                  body &&
                [...entry.querySelectorAll('button')].some(
                  (button) =>
                    button.textContent.trim() === label && !button.disabled
                )
            ),
          {},
          selector,
          body,
          label
        );
        await page.evaluate(
          (selector, body, label) => {
            const entry = [...document.querySelectorAll(selector)].find(
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
          selector,
          body,
          label
        );
      }
      async function enter(page, name, body) {
        await fill('#quick-discussion-name', name, page);
        await fill('#quick-discussion-text', body, page);
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
        await idle(page);
      }
      async function inspect(page) {
        const modal = await page.evaluate((host) => {
          const dialog = document.querySelector(host);
          const scroll = dialog.querySelector('.discussion-body');
          const bounds = dialog.getBoundingClientRect();
          const fields = [
            ...dialog.querySelectorAll('.application-draft-input'),
          ];
          const ids = [...document.querySelectorAll('[id]')].map(
            (item) => item.id
          );
          const textarea = dialog.querySelector('textarea');
          let composerReachable = null;
          if (textarea) {
            textarea.focus();
            textarea.scrollIntoView({ block: 'center', behavior: 'instant' });
            const field = textarea.getBoundingClientRect();
            const viewport = scroll.getBoundingClientRect();
            composerReachable =
              (textarea.disabled || document.activeElement === textarea) &&
              field.top >= viewport.top - 1 &&
              field.bottom <= viewport.bottom + 1;
          }
          const result = {
            withinViewport:
              bounds.left >= -1 &&
              bounds.right <= innerWidth + 1 &&
              bounds.top >= -1 &&
              bounds.bottom <= innerHeight + 1,
            horizontalOverflow: scroll.scrollWidth > scroll.clientWidth + 1,
            composerReachable,
            composerDisabled: textarea?.disabled ?? null,
            distinctFieldIds: fields.every(
              (field) => ids.filter((id) => id === field.id).length === 1
            ),
            themedFields: fields.every(
              (field) =>
                Number.parseFloat(getComputedStyle(field).borderTopWidth) > 0
            ),
            scrollHeight: scroll.scrollHeight,
            clientHeight: scroll.clientHeight,
          };
          scroll.scrollTop = 0;
          return result;
        }, host);
        assert.equal(modal.withinViewport, true, JSON.stringify(modal));
        assert.equal(modal.horizontalOverflow, false, JSON.stringify(modal));
        assert.notEqual(modal.composerReachable, false, JSON.stringify(modal));
        assert.equal(modal.distinctFieldIds, true);
        assert.equal(modal.themedFields, true);
        return { modal };
      }
      const captureModal = (state, page) => capture(state, page, inspect);

      await go(route, reader);
      await open(reader);
      await modalText(reader, 'A real quick discussion.');
      assert.equal(await reader.$(`${host} form`), null);
      await captureModal('quick-anonymous', reader);
      await close(reader);
      await go(route, alice);
      await open(alice);
      await modalText(alice, 'Write a reply');
      assert.notEqual(await alice.$('#application-discussion-text'), null);
      assert.notEqual(await alice.$('#quick-discussion-text'), null);
      await captureModal('quick-member-long-thread', alice);
      await options.classify('mature');
      await switchSession(alice, 'draft-bob');
      await modalText(alice, 'A real quick discussion.');
      await switchSession(alice, 'draft-alice');
      await modalText(alice, 'Application hidden');
      const hidden = await alice.$eval(host, (element) => element.textContent);
      assert(!hidden.includes('Quick community conversation'));
      assert(!hidden.includes('Community discussions'));
      assert(!hidden.includes('A real quick discussion.'));
      assert.equal(await alice.$(`${host} application-discussions`), null);
      await captureModal('quick-classification-hidden', alice);
      setOffline((path) => path === '/api/me/preferences');
      await switchSession(alice, 'draft-bob');
      await modalText(alice, 'Content preferences unavailable');
      assert.equal(await alice.$(`${host} application-discussions`), null);
      await captureModal('quick-preferences-unavailable', alice);
      setOffline(false);
      await button(alice, 'Retry content preferences');
      await modalText(alice, 'A real quick discussion.');
      await options.classify('general');
      await switchSession(alice, 'draft-alice');
      await modalText(alice, 'Write a reply');
      await alice.focus('#quick-discussion-text');
      for (let step = 0; step < 10; step++) {
        await alice.keyboard.press('Tab');
        assert.equal(
          await alice.evaluate(
            () => !!document.activeElement.closest('tui-dialog')
          ),
          true,
          'Focus escaped the dialog'
        );
      }

      await go(route, bob);
      await open(bob);
      const requests = [];
      bob.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          request.url().endsWith(`/${root.id}/replies`)
        )
          requests.push({
            body: request.postData(),
            key: request.headers()['idempotency-key'],
          });
      });
      loseResponse(
        (url, method) =>
          url === `/api/${base}/${root.id}/replies` && method === 'POST'
      );
      await enter(bob, 'Public Bob', 'An exact reply retried after reopening.');
      await button(bob, 'Post reply');
      await modalText(bob, 'Resolve the last discussion request');
      assert.equal(
        await bob.$eval('#quick-discussion-text', (field) => field.disabled),
        true
      );
      await captureModal('quick-uncertain', bob);
      await waitThread(application.id, root.id, 2);
      await close(bob);
      await open(bob);
      await modalText(bob, 'Resolve the last discussion request');
      await button(bob, 'Retry last discussion request');
      await modalText(bob, 'Discussion change saved.');
      assert.equal(requests.length, 2);
      assert.deepEqual(requests[1], requests[0]);
      assert.ok(requests[0].key);
      const afterRetry = await waitThread(application.id, root.id, 2);
      assert.equal(
        afterRetry.comments.filter(
          (comment) =>
            comment.content?.text === 'An exact reply retried after reopening.'
        ).length,
        1
      );
      await captureModal('quick-retried', bob);

      await reload(alice);
      await go(route, independent);
      await open(independent);
      await action(alice, initialText.trim(), 'Edit post');
      await fill(
        '#quick-discussion-title',
        'Updated quick community conversation',
        alice
      );
      await fill('#quick-discussion-text', 'A revised opening post.', alice);
      await button(alice, 'Save post');
      await waitThread(application.id, root.id, 3);
      await action(independent, initialText.trim(), 'Edit post');
      await fill(
        '#quick-discussion-text',
        'My conflicting modal edit.',
        independent
      );
      await button(independent, 'Save post');
      await modalText(independent, 'The thread changed.');
      assert.equal(
        await independent.$eval(
          '#quick-discussion-text',
          (field) => field.value
        ),
        'My conflicting modal edit.'
      );
      await captureModal('quick-conflict', independent);

      await options.stopWorker();
      await enter(bob, 'Public Bob', 'A reply waiting for materialization.');
      await button(bob, 'Post reply');
      await modalText(bob, 'Discussion change saved.');
      await modalText(bob, 'Discussions are unavailable or still updating.');
      await captureModal('quick-projection-pending', bob);
      options.startWorker();
      await waitThread(application.id, root.id, 4);
      await reload(bob, 'A reply waiting for materialization.');
      await options.restart();
      await reload(bob, 'A revised opening post.');

      await reload(alice);
      loseResponse(
        (url, method) =>
          url === `/api/${base}/${root.id}/replies` && method === 'POST'
      );
      await enter(
        alice,
        'Public Alice',
        'A committed reply before switching accounts.'
      );
      await button(alice, 'Post reply');
      await modalText(alice, 'Resolve the last discussion request');
      await waitThread(application.id, root.id, 5);
      const beforeSwitch = commands.length;
      await switchSession(alice, 'draft-bob');
      assert.equal(
        await alice.$eval('#quick-discussion-text', (field) => field.value),
        ''
      );
      assert.equal(
        await alice.$eval(host, (dialog) =>
          dialog.textContent.includes('Resolve the last discussion request')
        ),
        false
      );
      assert.equal(commands.length, beforeSwitch);
      await captureModal('quick-account-switch', alice);
      await switchSession(alice, null);
      await modalText(alice, 'Sign in to start a discussion');
      assert.equal(await alice.$(`${host} form`), null);
      await captureModal('quick-signed-out', alice);

      await close(bob);
      await go('/me/discussions', bob);
      await text('You replied', bob);
      await text('3 replies', bob);
      await go(route, moderator);
      await open(moderator);
      assert.equal(
        await moderator.$$eval(`${host} button`, (buttons) =>
          buttons.some((button) => button.textContent.trim() === 'Edit post')
        ),
        false
      );
      await action(
        moderator,
        'An exact reply retried after reopening.',
        'Remove post'
      );
      await captureModal('quick-moderation', moderator);
      await button(moderator, 'Confirm removal');
      await waitThread(application.id, root.id, 6);
      await reload(moderator, 'Post removed. Replies remain');
      await open(bob);
      await action(bob, 'A reply waiting for materialization.', 'Remove post');
      await button(bob, 'Confirm removal');
      await waitThread(application.id, root.id, 7);
      await close(bob);
      await text('No visible discussions', bob);
      await capture('quick-private-list-refreshed', bob);

      await open(reader);
      await modalText(reader, 'A revised opening post.');
      await reader.click(`${host} a`);
      await reader.waitForSelector(host, { hidden: true });
      await text('A revised opening post.', reader);
      assert.ok(reader.url().endsWith(`/${root.id}`));
      await go(route, reader);
      setOffline(true);
      await open(reader);
      await modalText(reader, 'Application unavailable');
      await captureModal('quick-catalog-unavailable', reader);
      setOffline(false);
      await button(reader, 'Reload application');
      await modalText(reader, 'A revised opening post.');
      setOffline(true);
      await reload(reader, 'Discussions are unavailable or still updating.');
      await captureModal('quick-discussion-unavailable', reader);
      setOffline(false);
      await reload(reader, 'A revised opening post.');
      await options.withdraw();
      await reload(
        reader,
        'The application or discussion is no longer available.'
      );
      assert.equal(await reader.$(`${host} .discussion-entry`), null);
      await captureModal('quick-withdrawn-parent', reader);
      await options.republish();
      await reload(reader, 'A revised opening post.');
      await close(independent);
      await open(independent);
      await action(independent, 'A revised opening post.', 'Remove post');
      await button(independent, 'Confirm removal');
      await modalText(
        independent,
        'The application or discussion is no longer available.'
      );
      await captureModal('quick-removed-root', independent);
      await reload(
        reader,
        'The application or discussion is no longer available.'
      );
      return [
        'Reviewed parent classification hides modal titles, messages and forms; preference outage clears content and retry restores the current account choice',
        'Real anonymous/member modal reads, independent field IDs, keyboard containment and reachable composer at three widths in both themes',
        'Reply persists once after lost response, close/reopen and exact command/key retry; API restart retains content',
        'Owner editing preserves conflicting text; projection lag clears stale content until current generation exists',
        'Session changes clear private forms/retry; signout removes mutation controls',
        'Independent moderation and author removal redact replies; closing refreshes My Discussions membership',
        'Full-thread navigation disposes modal; catalog/Discussion outage recovery, current parent withdrawal and root removal deny stale access',
      ];
    },
  });
}

module.exports = { quickDiscussionBrowser };
