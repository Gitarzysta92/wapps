const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

async function applicationOwnershipBrowser(options) {
  const {
    source,
    root,
    reader,
    projections,
    records,
    restart,
    origin,
    headers,
  } = options;
  const { projectEditorialSnapshot } = require(path.join(
    root,
    'apps/services/editorial/src/app/application/editorial-materialization'
  ));
  const request = async (
    method,
    route,
    body,
    uid = 'OwnershipBrowserPublisher',
    roles = ['editorial:publisher']
  ) => {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: {
        ...headers(uid, 'default', roles),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    assert(
      response.ok,
      `${method} ${route}: ${response.status} ${JSON.stringify(result)}`
    );
    return result;
  };
  const fields = {
    name: 'Browser Ownership Application',
    slug: 'browser-ownership-application',
    website: 'https://browser-ownership.example.test',
    description:
      'Canonical application content for ownership and verified authoring.',
  };
  const application = await request('POST', 'apps', fields);
  const publish = async () =>
    projections.publish(
      projectEditorialSnapshot(await reader.read('app', application.id))
    );
  await publish();
  const publicRoute = '/apps/' + fields.slug + '/overview';
  return require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    ownershipWorkflow: async ({
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
      const owner = await session('draft-alice');
      const independent = await session('draft-alice');
      const reviewer = await session('ownership-reviewer');
      const contentReviewer = await session('draft-reviewer');
      const bob = await session('draft-bob');
      const anonymous = await session('');
      const navigate = async (href, page) => {
        await page.$eval(`a[href="${href}"]`, (link) => link.click());
        await page.waitForFunction(
          (href) => location.pathname === href,
          {},
          href
        );
      };
      const publicText = async (value) => {
        await go(publicRoute, anonymous);
        await anonymous.waitForFunction(
          (value) =>
            document
              .querySelector('app-application-overview-page')
              ?.textContent.includes(value),
          {},
          value
        );
      };
      const currentClaim = async (claimId) =>
        request(
          'GET',
          'me/ownership-claims/' + claimId,
          undefined,
          'DraftBrowserAlice',
          []
        );
      const create = async (lost = false) => {
        await publish();
        await go('/apps/ownership/' + fields.slug, owner);
        await text('Public evidence URL', owner);
        await fill('#ownership-evidence', fields.website + '/team', owner);
        await fill(
          '#ownership-notes',
          'I maintain the application and control its official website.',
          owner
        );
        if (lost) loseResponse();
        await click('Create ownership claim', owner);
        if (lost) {
          await text('Retry unconfirmed change', owner);
          const key = commands.at(-1).key;
          await navigate('/my/ownership', owner);
          await text('Retry unconfirmed change', owner);
          await click('Retry unconfirmed change', owner);
          await text('Verify website control', owner);
          assert.equal(commands.at(-1).key, key);
        }
        await owner.waitForFunction(() =>
          /^\/my\/ownership\/[^/]+$/.test(location.pathname)
        );
        await text('Claim awaiting-proof', owner);
        return new URL(owner.url()).pathname.split('/').at(-1);
      };
      const proof = async () => {
        const challenge = await owner.evaluate(() => ({
          name: document
            .querySelector('[data-ownership-name]')
            .textContent.trim(),
          value: document
            .querySelector('[data-ownership-value]')
            .textContent.trim(),
        }));
        records.set(challenge.name, challenge.value);
        await click('Check DNS proof', owner);
        await text('Claim awaiting-review', owner);
      };
      const approve = async (claimId, lost = false) => {
        await go('/editorial/ownership/' + claimId, reviewer);
        await text('Independent staff decision', reviewer);
        if (lost) loseResponse();
        await click('Approve ownership', reviewer);
        if (lost) {
          await text('Retry unconfirmed change', reviewer);
          const key = commands.at(-1).key;
          await navigate('/editorial/ownership/grants', reviewer);
          await text('Retry unconfirmed change', reviewer);
          await click('Retry unconfirmed change', reviewer);
          await reviewer.waitForFunction(
            (claimId) =>
              location.pathname === '/editorial/ownership/' + claimId,
            {},
            claimId
          );
          assert.equal(commands.at(-1).key, key);
        }
        await text('Claim approved', reviewer);
      };

      await go('/my/ownership', owner);
      await text('No ownership claims yet', owner);
      await capture('ownership-empty', owner);
      await go(publicRoute, owner);
      await owner.waitForSelector(`a[href="/apps/ownership/${fields.slug}"]`);
      await navigate('/apps/ownership/' + fields.slug, owner);
      await text('Claim ' + fields.name, owner);
      await owner.focus('#ownership-evidence');
      await owner.keyboard.press('Tab');
      assert.equal(
        await owner.evaluate(() => document.activeElement.id),
        'ownership-notes'
      );
      await capture('ownership-form', owner);
      const cancelledId = await create(true);
      await capture('ownership-challenge', owner);
      await click('Check DNS proof', owner);
      await text('matching TXT record was not found', owner);
      await capture('ownership-negative-proof', owner);
      await click('Cancel claim', owner);
      await click('Confirm cancel', owner);
      await text('Claim cancelled', owner);
      assert.equal((await currentClaim(cancelledId)).status, 'cancelled');

      const rejectedId = await create();
      await proof();
      await go('/editorial/ownership/' + rejectedId, contentReviewer);
      await text('permission', contentReviewer);
      await capture('ownership-review-forbidden', contentReviewer);
      await go('/my/ownership/' + rejectedId, bob);
      await text('not found', bob);
      await go('/editorial/ownership', reviewer);
      await text(fields.name, reviewer);
      await capture('ownership-review-queue', reviewer);
      await go('/editorial/ownership/' + rejectedId, reviewer);
      await fill(
        '#ownership-reason',
        'Explain the relationship between the project and the claimant.',
        reviewer
      );
      await click('Reject ownership claim', reviewer);
      await text('Claim rejected', reviewer);
      await go('/my/ownership/' + rejectedId, owner);
      await text('Explain the relationship', owner);
      await capture('ownership-rejected', owner);

      const claimId = await create();
      await proof();
      await capture('ownership-proven', owner);
      await approve(claimId, true);
      await capture('ownership-approved-review', reviewer);
      await go('/editorial/ownership/grants', reviewer);
      await text(fields.name, reviewer);
      await capture('ownership-active-grants', reviewer);
      await restart();
      await go('/my/ownership/' + claimId, independent);
      await text('Verified-owner editing', independent);
      await capture('ownership-approved-owner', independent);
      const editingRoute = '/my/apps/owned/' + application.id;
      await navigate(editingRoute, independent);
      await text('New editing draft', independent);
      await independent.focus('#application-editing-name');
      await independent.keyboard.press('Tab');
      assert.equal(
        await independent.evaluate(() => document.activeElement.tagName),
        'SUMMARY'
      );
      await independent.keyboard.press('Enter');
      assert.equal(
        await independent.$eval('details', (details) => details.open),
        true
      );
      await independent.select('#application-editing-classification', 'mature');
      await click('Use approved classification', independent);
      assert.equal(
        await independent.$eval(
          '#application-editing-classification',
          (input) => input.selectedOptions[0].textContent.trim()
        ),
        'Unclassified'
      );
      await independent.select(
        '#application-editing-classification',
        'general'
      );
      await capture('ownership-new-editing', independent);
      await fill(
        '#application-editing-name',
        'Verified Browser Content',
        independent
      );
      loseResponse();
      await click('Save private draft', independent);
      await text('Retry unconfirmed change', independent);
      const openKey = commands.at(-1).key;
      await click('Retry unconfirmed change', independent);
      await independent.waitForFunction(() =>
        new URLSearchParams(location.search).has('draftId')
      );
      assert.equal(commands.at(-1).key, openKey);
      const draftId = new URL(independent.url()).searchParams.get('draftId');
      assert.notEqual(draftId, application.id);
      const editDraftRoute = editingRoute + '?draftId=' + draftId;
      const publicationRoute = '/my/apps/' + draftId + '/publication';
      const contentReviewRoute = '/editorial/apps/' + draftId;
      await text('Private editing draft', independent);
      await capture('ownership-private-editing', independent);
      await go(publicationRoute, independent);
      await click('Submit for review', independent);
      await text('Submission 1: submitted', independent);
      await go(editDraftRoute, owner);
      assert.equal(
        await owner.$eval(
          '#application-editing-classification',
          (input) => input.value
        ),
        'general'
      );
      await owner.select('#application-editing-classification', 'mature');
      await fill(
        '#application-editing-name',
        'Later Private Owner Text',
        owner
      );
      await click('Save private draft', owner);
      await text('Private editing draft saved', owner);
      await go(contentReviewRoute, contentReviewer);
      await text('Verified Browser Content', contentReviewer);
      await text('Submitted classification: general', contentReviewer);
      assert.equal(
        await contentReviewer.$eval('application-publication-page', (host) =>
          host.textContent.includes('Later Private Owner Text')
        ),
        false
      );
      await click('Approve publication', contentReviewer);
      await text('Submission 1: approved', contentReviewer);
      await publicText('Unable to load application');
      await publish();
      assert.equal(
        (await projections.find('app', application.id)).content.classification,
        'general'
      );
      await publicText('Verified Browser Content');
      assert.equal(
        await anonymous.$eval('app-application-overview-page', (host) =>
          host.textContent.includes('Later Private Owner Text')
        ),
        false
      );
      assert.equal(
        (
          await source.query('SELECT id FROM app_records WHERE id = ?', [
            draftId,
          ])
        ).length,
        0
      );
      await go(publicationRoute, owner);
      await click('Submit for review', owner);
      await text('Submission 4: submitted', owner);
      const canonical = await request(
        'GET',
        'me/application-drafts/canonical/' + application.id,
        undefined,
        'DraftBrowserAlice',
        []
      );
      await request(
        'PUT',
        'apps/' + application.id,
        {
          name: 'Independent Staff Correction',
          expectedRevision: canonical.sourcePublicationRevision,
        },
        'OwnershipBrowserModerator',
        ['editorial:moderator']
      );
      await go(contentReviewRoute, contentReviewer);
      await click('Approve publication', contentReviewer);
      await text('changed', contentReviewer);
      await go(editDraftRoute, owner);
      await text('canonical application changed', owner);
      await fill(
        '#application-editing-description',
        'Unsaved private description retained while the canonical revision is refreshed.',
        owner
      );
      await click('Refresh canonical content', owner);
      await text('canonical application changed', owner);
      assert.equal(
        await owner.$eval('#application-editing-name', (input) => input.value),
        'Later Private Owner Text'
      );
      assert.match(
        await owner.$eval(
          '#application-editing-description',
          (input) => input.value
        ),
        /Unsaved private/
      );
      await capture('ownership-canonical-conflict', owner);
      await click('Use canonical application name', owner);
      await click('Merge with current revision', owner);
      await capture('ownership-merge-confirmation', owner);
      loseResponse();
      await click('Confirm merged draft', owner);
      await text('Retry unconfirmed change', owner);
      const mergeKey = commands.at(-1).key;
      await click('Retry unconfirmed change', owner);
      await text('Pending review was cancelled', owner);
      assert.equal(commands.at(-1).key, mergeKey);
      await go(publicationRoute, independent);
      await text('Submission 4: cancelled', independent);
      await restart();
      await go(editDraftRoute, independent);
      assert.match(
        await independent.$eval(
          '#application-editing-description',
          (input) => input.value
        ),
        /Unsaved private/
      );
      await publish();
      await publicText('Independent Staff Correction');
      assert.equal(
        await anonymous.$eval('app-application-overview-page', (host) =>
          host.textContent.includes('Unsaved private')
        ),
        false
      );

      setOffline(true);
      await go('/my/ownership', owner);
      await text('unavailable', owner);
      await capture('ownership-outage', owner);
      setOffline(false);
      await click('Reload ownership', owner);
      await text(fields.name, owner);
      await go('/editorial/ownership/grants', reviewer);
      await navigate('/editorial/ownership/' + claimId, reviewer);
      await fill(
        '#ownership-reason',
        'The verified maintainer no longer represents the project.',
        reviewer
      );
      await click('Revoke ownership', reviewer);
      await capture('ownership-revoke-confirmation', reviewer);
      await click('Confirm revoke', reviewer);
      await text('Claim revoked', reviewer);
      await go('/editorial/ownership/grants', reviewer);
      assert.equal(
        await reviewer.$(`a[href="/editorial/ownership/${claimId}"]`),
        null
      );
      await go(editDraftRoute, independent);
      await text('current ownership grant was not found', independent);
      await text('Private editing draft', independent);
      await fill(
        '#application-editing-slug',
        'archived-owner-work',
        independent
      );
      await click('Save private draft', independent);
      await text('Private editing draft saved', independent);
      await capture('ownership-revoked-private-draft', independent);
      const nextClaim = await create();
      await proof();
      await approve(nextClaim);
      await go(editDraftRoute, independent);
      await text('earlier ownership grant', independent);
      assert.equal(
        await independent.$eval('application-editing-page', (host) =>
          [...host.querySelectorAll('button')].some(
            (button) =>
              button.textContent.trim() === 'Merge with current revision'
          )
        ),
        false
      );
      await capture('ownership-obsolete-grant', independent);
      await go(publicationRoute, independent);
      await click('Submit for review', independent);
      await text('permission', independent);
      await go(editingRoute, owner);
      await text('New editing draft', owner);
      await click('Save private draft', owner);
      await owner.waitForFunction(() =>
        new URLSearchParams(location.search).has('draftId')
      );
      assert.notEqual(
        new URL(owner.url()).searchParams.get('draftId'),
        draftId
      );
      await go('/apps/register?draftId=' + draftId, independent);
      await click('Delete draft', independent);
      await click('Confirm deletion', independent);
      await text('New draft', independent);
      await publish();
      await publicText('Independent Staff Correction');
      await go('/my/ownership/' + nextClaim, owner);
      await click('Release ownership', owner);
      await click('Confirm release', owner);
      await text('Claim revoked', owner);
      await capture('ownership-released', owner);
      assert.equal((await currentClaim(nextClaim)).status, 'revoked');
      await go('/apps/ownership/' + fields.slug, owner);
      // A grant change invalidates the old projection; recover it before opening the public claim form.
      await publish();
      await go('/apps/ownership/' + fields.slug, owner);
      await fill(
        '#ownership-notes',
        'Account-specific text that must disappear when switching users.',
        owner
      );
      await owner.evaluate(() => {
        localStorage.setItem('_i', 'draft-bob');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: '_i',
            newValue: 'draft-bob',
            storageArea: localStorage,
          })
        );
      });
      await owner.waitForFunction(
        () => document.querySelector('#ownership-notes')?.value === ''
      );
      return [
        'public application entry, private claim creation, keyboard navigation and immutable DNS challenge',
        'real negative DNS proof, cancellation, positive proof, independent rejection and reason',
        'dedicated ownership reviewer, wrong-account denial and active-grants navigation',
        'lost claim, approval, editing and merge responses retain exact retry keys across navigation',
        'approved ownership and merged private content persist in independent browsers after two API restarts',
        'verified content publishes at the existing canonical ID with immutable independent review',
        'projection lag is unavailable and recovery restores canonical content without exposing later private edits',
        'staff revision conflict preserves private fields and requires an explicit merge cancelling pending review',
        'revoked grants preserve private work; later grants require a new draft and old-draft deletion preserves publication',
        'owner release, truthful outage/recovery and account-switch form isolation',
      ];
    },
  });
}
module.exports = { applicationOwnershipBrowser };
