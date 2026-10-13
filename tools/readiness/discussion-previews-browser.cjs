const assert = require('node:assert/strict');

async function discussionPreviewsBrowser(options) {
  const { application, discussion, accepted, waitThread } = options;
  const author = {
    identityId: 'DraftBrowserAlice',
    tenantId: 'default',
    roles: [],
  };
  const moderator = {
    ...author,
    identityId: 'CommentBrowserModerator',
    roles: ['admin'],
  };
  const base = `application-discussions/${application.id}`;
  const overview = `/apps/${application.slug}/overview`;
  const detail = (id) => `/apps/${application.slug}/discussions/${id}`;
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
      setOffline,
    }) => {
      const reader = await session(''),
        member = await session('draft-alice');
      const preview = 'application-discussion-previews';
      const shown = (page) =>
        page.$$eval(`${preview} article`, (nodes) =>
          nodes.map((node) => node.dataset.threadId)
        );
      const current = async () =>
        accepted(await discussion('GET', base, undefined, null)).items;
      async function agree(page, excluded = null) {
        const expected = (await current())
          .filter((item) => item.id !== excluded)
          .slice(0, 3)
          .map((item) => item.id);
        await page.waitForFunction(
          (expected) => {
            const ids = [
              ...document.querySelectorAll(
                'application-discussion-previews article'
              ),
            ].map((node) => node.dataset.threadId);
            return JSON.stringify(ids) === JSON.stringify(expected);
          },
          {},
          expected
        );
        assert.deepEqual(await shown(page), expected);
      }
      async function previewText(page, value) {
        await page.waitForFunction(
          (value) =>
            document
              .querySelector('application-discussion-previews')
              ?.textContent.includes(value),
          {},
          value
        );
      }
      async function inspect(page) {
        return page
          .evaluate(() => {
            const host = document.querySelector(
              'application-discussion-previews'
            );
            const related = host.closest('.related-topics');
            const cards = [...host.querySelectorAll('article')];
            return {
              previewCount: cards.length,
              previewWidths: cards.map((card) =>
                Math.round(card.getBoundingClientRect().width)
              ),
              relatedGap: related
                ? related.getBoundingClientRect().top -
                  related.previousElementSibling.getBoundingClientRect().bottom
                : null,
              relatedPadding: related
                ? Number.parseFloat(getComputedStyle(related).paddingTop)
                : null,
            };
          })
          .then((layout) => {
            assert(layout.previewCount <= 3);
            if (layout.relatedGap !== null) {
              assert(
                Math.abs(layout.relatedGap - 32) < 2,
                `Related section gap: ${layout.relatedGap}`
              );
              assert.equal(layout.relatedPadding, 24);
            }
            return layout;
          });
      }
      await go(overview, reader);
      await previewText(reader, 'No discussions yet.');
      await capture('previews-empty', reader, inspect);

      const topics = [];
      for (let n = 1; n <= 4; n++) {
        const saved = accepted(
          await discussion(
            'POST',
            base,
            {
              title: `Preview topic ${n}`,
              displayName: 'Chosen public author',
              text: `Durable topic ${n} for public discovery.`,
              tags: [],
            },
            author
          ),
          201
        );
        topics.push(saved);
        await waitThread(application.id, saved.id, saved.revision);
      }
      const pinned = accepted(
        await discussion(
          'PUT',
          `${base}/${topics[0].id}/pin`,
          { pinned: true, expectedRevision: 1 },
          moderator
        )
      );
      await waitThread(application.id, topics[0].id, pinned.revision);
      const reply = accepted(
        await discussion(
          'POST',
          `${base}/${topics[0].id}/replies`,
          {
            displayName: 'Another public member',
            text: 'An independently stored reply.',
          },
          moderator
        ),
        201
      );
      await waitThread(application.id, topics[0].id, reply.revision);
      await click('Reload previews', reader);
      await agree(reader);
      await previewText(reader, 'Pinned discussion');
      await previewText(reader, '1 reply (including removed posts)');
      await capture('previews-overview', reader, inspect);
      await go(overview, member);
      await agree(member);
      await member.focus(`${preview} article a`);
      await member.keyboard.press('Enter');
      await text('More discussions about this application', member);
      assert(member.url().endsWith(detail(topics[0].id)));
      await agree(member, topics[0].id);
      await fill(
        'application-discussions [name="post"]',
        'Unfinished text stays with this thread.',
        member
      );
      await click('Reload previews', member);
      await agree(member, topics[0].id);
      assert.equal(
        await member.$eval(
          'application-discussions [name="post"]',
          (field) => field.value
        ),
        'Unfinished text stays with this thread.'
      );
      await capture('previews-related', member, inspect);

      setOffline((url) => url === `/api/${base}`);
      await click('Reload previews', member);
      await previewText(member, 'Discussion previews unavailable');
      assert.deepEqual(await shown(member), []);
      assert.equal(
        await member.$eval(
          'application-discussions [name="post"]',
          (field) => field.value
        ),
        'Unfinished text stays with this thread.'
      );
      await capture('previews-related-unavailable', member, inspect);
      setOffline(false);
      await click('Reload previews', member);
      await agree(member, topics[0].id);

      await options.stopWorker();
      const edited = accepted(
        await discussion(
          'PUT',
          `${base}/${topics[0].id}`,
          {
            expectedRevision: reply.revision,
            content: {
              title: 'A changed pinned topic',
              displayName: 'Changed public name',
              text: 'Only the current approved-to-read version belongs in previews.',
              tags: [],
            },
          },
          author
        )
      );
      await click('Reload previews', reader);
      await previewText(reader, 'Discussion previews unavailable');
      assert.deepEqual(await shown(reader), []);
      await capture('previews-projection-pending', reader, inspect);
      await options.startWorker();
      await waitThread(application.id, topics[0].id, edited.revision);
      await click('Reload previews', reader);
      await previewText(reader, 'A changed pinned topic');
      await previewText(reader, 'Changed public name');
      await agree(reader);
      await options.restart();
      await go(overview, reader);
      await agree(reader);

      await options.stopWorker();
      await options.discussionDatabase
        .collection('discussion_generation_nodes')
        .deleteMany({});
      await options.discussionDatabase
        .collection('discussion_generation_heads')
        .deleteMany({});
      await click('Reload previews', reader);
      await previewText(reader, 'Discussion previews unavailable');
      assert.deepEqual(await shown(reader), []);
      await options.rebuild();
      await options.startWorker();
      await waitThread(application.id, topics[0].id, edited.revision);
      await click('Reload previews', reader);
      await agree(reader);
      await capture('previews-rebuilt', reader, inspect);

      await options.stopWorker();
      accepted(
        await discussion(
          'DELETE',
          `${base}/${topics[0].id}`,
          { expectedRevision: edited.revision },
          author
        )
      );
      await click('Reload previews', reader);
      await agree(reader);
      assert(!(await shown(reader)).includes(topics[0].id));
      await capture('previews-deleted', reader, inspect);
      await options.startWorker();

      await options.withdraw();
      await click('Reload previews', reader);
      await previewText(reader, 'Discussion previews unavailable');
      assert.deepEqual(await shown(reader), []);
      await capture('previews-parent-withdrawn', reader, inspect);
      await options.republish();
      await go(overview, reader);
      await agree(reader);
      return [
        'Overview and related previews use current bounded canonical topic order, real names/reply counts, and exclude the open thread',
        'Independent public/member browsers and keyboard links reach full topics; reloading previews preserves unfinished composer text',
        'Outage, projection lag/loss, edit, API restart and rebuild preserve explicit unavailable states and recover current content',
        'Topic deletion and parent withdrawal hide retained generations immediately; republishing restores eligible previews',
        'Preview cards and related section spacing are checked at mobile/tablet/desktop widths in both themes',
      ];
    },
  });
}

module.exports = { discussionPreviewsBrowser };
