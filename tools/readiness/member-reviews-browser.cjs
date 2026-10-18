const assert = require('node:assert/strict');

async function memberReviewsBrowser(options) {
  const { application, accepted, discussion } = options;
  const list = `/apps/${application.slug}/reviews`;
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
        second = await session('draft-alice');
      const bob = await session('draft-bob'),
        admin = await session('comment-moderator'),
        publicPage = await session('');
      const base = `application-reviews/${application.id}`;
      const author = {
        identityId: 'DraftBrowserAlice',
        tenantId: 'default',
        roles: [],
      };
      await go(list, alice);
      await text('Write a review', alice);
      await capture('reviews-public-list', alice);
      await click('Write a review', alice);
      await fill('[name="displayName"]', 'Browser review author', alice);
      await alice.focus('[name="displayName"]');
      await alice.keyboard.press('Tab');
      assert.equal(
        await alice.evaluate(() => document.activeElement.name),
        'rating'
      );
      await fill(
        '[name="reviewText"]',
        'An experience saved through real services.',
        alice
      );
      await capture('reviews-composer', alice);
      await click('Publish review', alice);
      await text('Review change saved.', alice);
      await text('An experience saved through real services.', alice);
      const mine = accepted(
        await discussion('GET', base, undefined, author)
      ).mine;
      const id = mine.id,
        detail = `/apps/${application.slug}/review/${id}`;
      await go(detail, publicPage);
      await text('An experience saved through real services.', publicPage);
      assert.equal(
        await publicPage.$$eval(
          'member-reviews [data-review-id]',
          (items) => items.length
        ),
        1
      );
      assert.equal(
        await publicPage.$eval('member-reviews', (element) =>
          /Verified Purchase|Top Reviewer|Browser Draft/.test(
            element.textContent
          )
        ),
        false
      );
      await capture('reviews-public-detail', publicPage);
      await go(detail, bob);
      await click('Helpful', bob);
      await text('Remove helpful mark', bob);
      await click('Report review', bob);
      await fill('[name="reportReason"]', 'Please check this experience.', bob);
      await click('Send report', bob);
      await text('Reported', bob);
      await capture('reviews-reported', bob);

      await go(detail, second);
      await click('Edit your review', second);
      await fill(
        '[name="reviewText"]',
        'Keep this unfinished revision.',
        second
      );
      // Helpful/report commands advanced the revision since Alice published.
      await go(list, alice);
      await click('Edit your review', alice);
      await fill(
        '[name="reviewText"]',
        'The independently updated experience.',
        alice
      );
      await click('Publish review', alice);
      await text('The independently updated experience.', alice);
      await click('Publish review', second);
      await text('The review changed.', second);
      assert.equal(
        await second.$eval('[name="reviewText"]', (field) => field.value),
        'Keep this unfinished revision.'
      );
      await capture('reviews-conflict', second);
      await click('Reload reviews', second);
      await text('The independently updated experience.', second);
      loseResponse((url) => url.endsWith('/mine'));
      await click('Publish review', second);
      await text('The change could not be confirmed.', second);
      const original = commands.at(-1);
      assert.equal(original.route, `/api/${base}/mine`);
      assert.equal(original.status, 200);
      await capture('reviews-uncertain', second);
      await click('Retry same request', second);
      await text('Review change saved.', second);
      assert.equal(commands.at(-1).key, original.key);
      assert.equal(await second.$('[name="reviewText"]'), null);
      await options.restart();
      await go(detail, publicPage);
      await text('Keep this unfinished revision.', publicPage);

      await go(detail, admin);
      await click('Moderate (1 open reports)', admin);
      await text('Please check this experience.', admin);
      await text('An experience saved through real services.', admin);
      await fill(
        '[name="moderationReason"]',
        'Staff is checking the reported content.',
        admin
      );
      await capture('reviews-moderation', admin);
      await click('Apply decision', admin);
      await text('Hidden by staff', admin);
      await click('Reload reviews', publicPage);
      await text(
        'This application or review is no longer available.',
        publicPage
      );
      await capture('reviews-hidden-public', publicPage);
      await go(detail, alice);
      await text('Staff is checking the reported content.', alice);
      await click('Edit your review', alice);
      await fill(
        '[name="reviewText"]',
        'A corrected experience for independent staff.',
        alice
      );
      await click('Publish review', alice);
      await text('Hidden by staff', alice);
      await capture('reviews-hidden-author', alice);
      await click('Reload reviews', admin);
      await text('A corrected experience for independent staff.', admin);
      await click('Moderate (0 open reports)', admin);
      await fill(
        '[name="moderationReason"]',
        'The correction resolves the concern.',
        admin
      );
      await click('Apply decision', admin);
      await text('Review change saved.', admin);
      await go(detail, publicPage);
      await text('A corrected experience for independent staff.', publicPage);
      await capture('reviews-restored-public', publicPage);

      await go(`/apps/${application.slug}/overview`, publicPage);
      const summary = accepted(await discussion('GET', `${base}/summary`));
      await text(`${summary.average.toFixed(1)}/5 from members`, publicPage);
      assert.equal(
        await publicPage.$eval('application-review-summary a', (link) =>
          link.getAttribute('href')
        ),
        list
      );
      await text(`(${summary.total} reviews)`, publicPage);
      await capture('reviews-overview-summary', publicPage);
      setOffline((url) => url === `/api/${base}/summary`);
      await go(`/apps/${application.slug}/overview`, publicPage);
      await text('Member ratings unavailable.', publicPage);
      assert.equal(await publicPage.$('application-review-summary a'), null);
      await capture('reviews-overview-unavailable', publicPage);
      setOffline(false);
      await click('Reload ratings', publicPage);
      await text(`(${summary.total} reviews)`, publicPage);
      await go(detail, publicPage);

      setOffline((url) => url.startsWith('/api/application-reviews/'));
      await click('Reload reviews', bob);
      await text('Reviews are unavailable.', bob);
      assert.equal(
        await bob.$$eval('member-reviews [data-review-id]', (items) => items.length),
        0
      );
      await capture('reviews-unavailable', bob);
      setOffline(false);
      await click('Reload reviews', bob);
      await text('A corrected experience for independent staff.', bob);
      await go(list, admin);
      await click('Moderate reviews', admin);
      await text('Moderation queue', admin);
      await capture('reviews-moderation-queue', admin);

      await go(detail, alice);
      await click('Edit your review', alice);
      await fill('[name="reviewText"]', 'Private unfinished text.', alice);
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
      await text('Report review', alice);
      assert.equal(await alice.$('[name="reviewText"]'), null);
      assert.equal(
        await alice.$eval('member-reviews', (element) =>
          element.textContent.includes('Withdraw your review')
        ),
        false
      );
      await capture('reviews-session-isolation', alice);
      await go(detail, second);
      await click('Withdraw your review', second);
      await text('Withdrawn by you.', second);
      await click('Reload reviews', publicPage);
      await text(
        'This application or review is no longer available.',
        publicPage
      );
      await capture('reviews-withdrawn', second);
      const own = accepted(
        await discussion('GET', base, undefined, author)
      ).mine;
      assert.equal(own.withdrawn, true);
      await options.withdraw();
      await click('Reload reviews', bob);
      await text('This application or review is no longer available.', bob);
      await options.republish();
      const retained = accepted(
        await discussion(
          'PUT',
          `${base}/mine`,
          {
            expectedRevision: 0,
            content: {
              displayName: 'Author before erasure',
              rating: 4,
              text: 'A public review retained after account erasure.',
            },
          },
          { ...author, identityId: 'DraftBrowserBob' }
        )
      );
      await options.eraseReviews('DraftBrowserBob');
      await go(`/apps/${application.slug}/review/${retained.id}`, publicPage);
      await text('Deleted account', publicPage);
      await text('A public review retained after account erasure.', publicPage);
      assert.equal(
        await publicPage.$eval('member-reviews', (element) =>
          /Author before erasure|Edit your review|Withdraw your review/.test(
            element.textContent
          )
        ),
        false
      );
      assert.equal(
        accepted(
          await discussion('GET', `${base}/${retained.id}`, undefined, null)
        ).mine,
        false
      );
      await capture('reviews-anonymous-public', publicPage);
      await options.eraseReviews(author.identityId);
      await go(detail, admin);
      await text('This application or review is no longer available.', admin);
      assert.equal(
        await admin.$eval('member-reviews', (element) =>
          element.textContent.includes(
            'A corrected experience for independent staff.'
          )
        ),
        false
      );
      await capture('reviews-erased-private', admin);
      return [
        'Real review create/edit/detail survives independent browsers, exact retry and API restart; demo review claims do not appear',
        'Helpful marks, reports, immutable reported text, independent staff hide/restore and author withdrawal use canonical revisions',
        'Conflict preserves unfinished text; outages clear stale public state; account changes clear author fields and private retry intent',
        'Overview displays canonical member totals/average and the real review link; summary outages remain unavailable and recover explicitly',
        'Review composer supports keyboard navigation between public name and rating',
        'After real bounded review cleanup, anonymous public content has no author controls; erased private reviews are unavailable even to staff. Cleanup is fixture-triggered, not a completed portal account-erasure journey.',
        'Changed review screens retain portal alignment and mobile/tablet/desktop layouts in both themes',
      ];
    },
  });
}

module.exports = { memberReviewsBrowser };
