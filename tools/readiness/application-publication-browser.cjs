const assert = require('node:assert/strict');
const path = require('node:path');

async function applicationPublicationBrowser(options) {
  const { source, root, reader, projections, restart } = options;
  const { projectEditorialSnapshot } = require(path.join(
    root,
    'apps/services/editorial/src/app/application/editorial-materialization'
  ));
  return require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    publicationWorkflow: async ({
      session,
      go,
      text,
      click,
      fill,
      capture,
      commands,
      loseResponse,
    }) => {
      const author = await session('draft-alice');
      const otherAuthor = await session('draft-alice');
      const reviewer = await session('draft-reviewer');
      const unauthorized = await session('draft-bob');
      const readerPage = await session('');
      await go('/apps/register', author);
      await fill(
        '#application-draft-name',
        'Browser Submitted Application',
        author
      );
      await fill(
        '#application-draft-slug',
        'browser-submitted-application',
        author
      );
      await fill('#application-draft-website', 'https://example.test', author);
      await fill(
        '#application-draft-description',
        'A real browser submission with immutable reviewed content.',
        author
      );
      await click('Save draft', author);
      await author.waitForFunction(() =>
        new URLSearchParams(location.search).has('draftId')
      );
      const id = new URL(author.url()).searchParams.get('draftId');
      const route = '/my/apps/' + id + '/publication';
      const reviewRoute = '/editorial/apps/' + id;
      const publicRoute = '/apps/browser-submitted-application/overview';
      const publish = async () =>
        projections.publish(
          projectEditorialSnapshot(await reader.read('app', id))
        );
      await go(route, author);
      await text('Saved draft: Browser Submitted Application', author);
      await capture('publication-ready', author);
      loseResponse();
      await click('Submit for review', author);
      await text('Retry unconfirmed change', author);
      const submitKey = commands.at(-1).key;
      await click('Retry unconfirmed change', author);
      await text('Submission 1: submitted', author);
      assert.equal(commands.at(-1).key, submitKey);
      await capture('publication-submitted', author);
      await go('/editorial/apps', unauthorized);
      await text('permission', unauthorized);
      await capture('review-forbidden', unauthorized);
      await go(route, unauthorized);
      await text('not found', unauthorized);
      await go('/editorial/apps', reviewer);
      await text('Browser Submitted Application', reviewer);
      await capture('review-queue', reviewer);

      await go('/apps/register?draftId=' + id, otherAuthor);
      await fill(
        '#application-draft-name',
        'Later Private Application',
        otherAuthor
      );
      await click('Save draft', otherAuthor);
      await text('Application draft saved to your account.', otherAuthor);
      await go(reviewRoute, reviewer);
      await text('Submission 1: submitted', reviewer);
      assert.equal(
        await reviewer.$eval('application-publication-page', (host) =>
          host.textContent.includes('Later Private Application')
        ),
        false
      );
      await capture('application-review', reviewer);
      loseResponse();
      await click('Approve publication', reviewer);
      await text('Retry unconfirmed change', reviewer);
      const approveKey = commands.at(-1).key;
      await capture('review-uncertain', reviewer);
      await click('Retry unconfirmed change', reviewer);
      await text('Submission 1: approved', reviewer);
      assert.equal(commands.at(-1).key, approveKey);
      await capture('application-approved', reviewer);
      assert.equal(
        Number(
          (
            await source.query(
              "SELECT revision FROM editorial_resource_states WHERE resourceKind = 'app' AND resourceId = ?",
              [id]
            )
          )[0].revision
        ),
        1
      );
      await publish();
      await go(publicRoute, readerPage);
      await readerPage.waitForFunction(() =>
        document
          .querySelector('app-application-overview-page')
          ?.textContent.includes('Browser Submitted Application')
      );
      assert.equal(
        await readerPage.$eval('app-application-overview-page', (host) =>
          host.textContent.includes('Later Private Application')
        ),
        false
      );
      await restart();
      await go(route, author);
      await text('Published submission 1', author);
      await text('Later Private Application', author);
      await click('Submit for review', author);
      await text('Submission 4: submitted', author);
      await go(reviewRoute, reviewer);
      await text('Later Private Application', reviewer);
      await fill(
        '#application-review-reason',
        'Please explain the application more clearly.',
        reviewer
      );
      await click('Reject submission', reviewer);
      await text('Submission 4: rejected', reviewer);
      await go(route, author);
      await text('Please explain the application more clearly.', author);
      await capture('application-rejected', author);
      await go(publicRoute, readerPage);
      await readerPage.waitForFunction(() =>
        document
          .querySelector('app-application-overview-page')
          ?.textContent.includes('Browser Submitted Application')
      );
      await click('Withdraw application', author);
      await click('Confirm withdrawal', author);
      await text('no longer public', author);
      await capture('application-withdrawn', author);
      const notFound = async () => {
        await go(publicRoute, readerPage);
        await readerPage.waitForFunction(() =>
          /not found|unavailable/i.test(
            document.querySelector('app-application-overview-page')
              ?.textContent ?? ''
          )
        );
      };
      await notFound();
      await click('Submit for review', author);
      await text('Submission 7: submitted', author);
      await go(reviewRoute, reviewer);
      await click('Approve publication', reviewer);
      await text('Submission 7: approved', reviewer);
      await publish();
      await go('/apps/register?draftId=' + id, author);
      await click('Delete draft', author);
      await click('Confirm deletion', author);
      await text('No application drafts yet', author);
      await notFound();
      return [
        'browser immutable submission/review/publication',
        'lost submission/approval responses retry once',
        'unauthorized reviewer and cross-owner denial',
        'later private edits stay private',
        'public catalog reading in an independent anonymous browser',
        'rejection reason preserves approved public version',
        'API restart with approved content',
        'withdrawal/deletion hide public content during projection lag',
      ];
    },
  });
}
module.exports = { applicationPublicationBrowser };
