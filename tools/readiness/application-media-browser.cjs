const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const sharp = require('sharp');

async function applicationMediaBrowser(options) {
  const {
    source,
    root,
    reader,
    projections,
    restart,
    headers,
    configurePublicOrigin,
    output,
  } = options;
  const { projectEditorialSnapshot } = require(path.join(
    root,
    'apps/services/editorial/src/app/application/editorial-materialization'
  ));
  const json = async (
    method,
    route,
    body,
    actor = 'DraftBrowserAlice',
    roles = []
  ) => {
    const response = await fetch(options.origin() + '/api/' + route, {
      method,
      headers: {
        ...headers(actor, 'default', roles),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert(
      response.ok,
      `${method} ${route}: ${response.status} ${JSON.stringify(value)}`
    );
    return value;
  };
  const files = {};
  for (const [name, background] of Object.entries({
    logo: '#197080',
    banner: '#d5952b',
    replacement: '#4f8057',
  })) {
    files[name] = path.join(output, `input-${name}.png`);
    await sharp({ create: { width: 80, height: 48, channels: 3, background } })
      .png()
      .toFile(files[name]);
  }
  return require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    workflowOnly: true,
    mediaWorkflow: async ({
      origin,
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
      await configurePublicOrigin(origin);
      const author = await session('draft-alice');
      const independent = await session('draft-alice');
      const reviewer = await session('draft-reviewer');
      const successor = await session('draft-bob');
      const anonymous = await session('');
      const idle = (page) =>
        page.waitForFunction(() => {
          const editor = document.querySelector('application-media-editor');
          return (
            editor &&
            editor.querySelector('[aria-busy]')?.getAttribute('aria-busy') ===
              'false'
          );
        });
      const select = async (page, label, file) => {
        const selector = `input[type="file"][aria-label="${label}"]`;
        await page.waitForFunction(
          (selector) => {
            const input = document.querySelector(selector);
            return input && !input.disabled;
          },
          {},
          selector
        );
        await (await page.$(selector)).uploadFile(file);
      };
      const current = (id, actor) =>
        json('GET', 'me/application-drafts/' + id, undefined, actor);
      const uploads = (id) =>
        json('GET', 'me/application-images?draftId=' + id);
      const storage = (page) =>
        page.evaluate(() =>
          sessionStorage.getItem('wapps.application-media.intent.v1')
        );
      const image = async (page, label) => {
        const selector = `application-image-preview img[alt="${label}"]`;
        await page.waitForFunction(
          (selector) => {
            const image = document.querySelector(selector);
            return image?.complete && image.naturalWidth > 0;
          },
          {},
          selector
        );
        return page.$eval(selector, async (image) => {
          const bytes = await (await fetch(image.src)).arrayBuffer();
          return Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
            (value) => value.toString(16).padStart(2, '0')
          ).join('');
        });
      };
      const upload = async (page, purpose, file) => {
        await select(page, 'Upload ' + purpose, file);
        await text('Upload confirmed.', page);
        await idle(page);
      };
      const use = async (page, purpose) => {
        await click('Use image as ' + purpose, page);
        await text('Draft image saved.', page);
        await idle(page);
      };
      const publicationState = (page, state) =>
        page.waitForFunction(
          (state) =>
            [
              ...document.querySelectorAll('application-publication-page p'),
            ].some((item) =>
              new RegExp('^Submission [0-9]+: ' + state + '$').test(
                item.textContent.trim()
              )
            ),
          {},
          state
        );
      const create = async (slug) => {
        await go('/apps/register', author);
        await fill(
          '#application-draft-name',
          'Browser Media Application',
          author
        );
        await fill('#application-draft-slug', slug, author);
        await fill(
          '#application-draft-website',
          'https://example.test',
          author
        );
        await fill(
          '#application-draft-description',
          'A real browser media workflow with privately edited and independently reviewed images.',
          author
        );
        await click('Save draft', author);
        await author.waitForFunction(() =>
          new URLSearchParams(location.search).has('draftId')
        );
        await idle(author);
        return new URL(author.url()).searchParams.get('draftId');
      };
      const id = await create('browser-media-application');
      const route = '/apps/register?draftId=' + id;
      const publicationRoute = '/my/apps/' + id + '/publication';
      const reviewRoute = '/editorial/apps/' + id;
      await go(route, independent);
      loseResponse(
        (route, method) =>
          route === '/api/me/application-images' && method === 'POST'
      );
      await select(author, 'Upload logo', files.logo);
      await text('Finish the pending image change', author);
      await idle(author);
      const reservedKey = commands.at(-1).key;
      const retained = await storage(author);
      assert(
        !retained.includes('draft-alice') &&
          !retained.includes('input-logo.png')
      );
      await author.reload({ waitUntil: 'networkidle0' });
      await select(author, 'Original image for retry', files.banner);
      await text('exact original file', author);
      assert.equal(commands.at(-1).key, reservedKey);
      await select(author, 'Original image for retry', files.logo);
      await text('Upload confirmed.', author);
      await idle(author);
      const logoA = (await uploads(id))[0];
      assert.equal(
        commands.filter((command) => command.key === reservedKey).length,
        2
      );
      await click('Preview upload', author);
      assert.equal(await image(author, 'uploaded logo'), logoA.asset.sha256);
      await fill('#application-draft-name', 'Unsaved media title', author);
      await use(author, 'logo');
      assert.equal(
        await author.$eval('#application-draft-name', (input) => input.value),
        'Unsaved media title'
      );
      assert.equal((await current(id)).name, 'Browser Media Application');
      assert.equal(await image(author, 'draft logo'), logoA.asset.sha256);
      await click('Reload uploads', independent);
      await idle(independent);
      await click('Use image as logo', independent);
      await text('changed', independent);
      assert.equal((await current(id)).revision, 2);
      await click('Cancel unused upload', author);
      await text('referenced', author);
      await click('Remove logo', author);
      await text('Draft image saved.', author);
      await idle(author);
      await click('Cancel unused upload', author);
      await text('Unused upload cancelled.', author);
      await idle(author);
      assert.equal((await uploads(id)).length, 0);
      await capture('media-removed-cancelled', author);

      loseResponse(
        (route, method) => route.endsWith('/content') && method === 'PUT'
      );
      await select(author, 'Upload logo', files.logo);
      await text('Finish the pending image change', author);
      await idle(author);
      const uploadedKey = commands.at(-1).key;
      await author.reload({ waitUntil: 'networkidle0' });
      await select(author, 'Original image for retry', files.logo);
      await text('Upload confirmed.', author);
      await idle(author);
      assert.equal(commands.at(-1).key, uploadedKey);
      loseResponse(
        (route, method) => route.endsWith('/images') && method === 'PUT'
      );
      await click('Use image as logo', author);
      await text('Finish the pending image change', author);
      await idle(author);
      const attachedKey = commands.at(-1).key;
      await capture('media-unconfirmed-attachment', author);
      await author.reload({ waitUntil: 'networkidle0' });
      await click('Retry image change', author);
      await text('Draft image saved.', author);
      await idle(author);
      assert.equal(commands.at(-1).key, attachedKey);
      assert.equal(await storage(author), null);
      await upload(author, 'banner', files.banner);
      await use(author, 'banner');
      const saved = await current(id);
      assert.equal(
        await image(author, 'draft logo'),
        saved.images.logo.asset.sha256
      );
      assert.equal(
        await image(author, 'draft banner'),
        saved.images.banner.asset.sha256
      );
      await capture('media-attached', author);

      loseResponse(
        (route, method) => route.endsWith('/content') && method === 'PUT'
      );
      await select(author, 'Upload logo', files.replacement);
      await text('Finish the pending image change', author);
      await idle(author);
      await go('/my/apps', author);
      await click('Cancel pending upload', author);
      await text('Unused upload cancelled.', author);
      assert.equal(await storage(author), null);
      assert.equal((await uploads(id)).length, 2);
      await go(route, author);
      setOffline(true);
      await click('Reload uploads', author);
      await text('unavailable', author);
      await capture('media-unavailable', author);
      setOffline(false);
      await click('Reload uploads', author);
      await idle(author);
      assert.equal(
        await author.$eval('application-media-editor', (host) =>
          host.textContent.includes('unavailable')
        ),
        false
      );

      await go(publicationRoute, author);
      await click('Submit for review', author);
      await publicationState(author, 'submitted');
      await image(author, 'submitted logo');
      await go(route, author);
      await click('Remove logo', author);
      await text('Draft image saved.', author);
      await idle(author);
      await go(reviewRoute, successor);
      await text('permission', successor);
      await go(route, successor);
      await text('not found', successor);
      assert.equal(await successor.$('application-image-preview img'), null);
      await go(reviewRoute, reviewer);
      assert.equal(
        await image(reviewer, 'submitted logo'),
        saved.images.logo.asset.sha256
      );
      assert.equal(
        await image(reviewer, 'submitted banner'),
        saved.images.banner.asset.sha256
      );
      await capture('media-frozen-review', reviewer);
      await click('Approve publication', reviewer);
      await publicationState(reviewer, 'approved');
      await projections.publish(
        projectEditorialSnapshot(await reader.read('app', id))
      );
      await go('/apps/browser-media-application/overview', anonymous);
      await anonymous.waitForFunction(() =>
        document
          .querySelector('app-application-overview-page')
          ?.textContent.includes('Browser Media Application')
      );
      const [publicRecord] = await source.query(
        'SELECT logoUrl, bannerUrl FROM app_records WHERE id = ?',
        [id]
      );
      const publicStatus = (url) =>
        anonymous.evaluate(async (url) => (await fetch(url)).status, url);
      assert.equal(await publicStatus(publicRecord.logoUrl), 200);
      await restart();
      await go(reviewRoute, reviewer);
      assert.equal(
        await image(reviewer, 'submitted logo'),
        saved.images.logo.asset.sha256
      );
      await go(publicationRoute, author);
      await click('Withdraw application', author);
      await click('Confirm withdrawal', author);
      await text('no longer public', author);
      assert.equal(await publicStatus(publicRecord.logoUrl), 404);
      await go(route, author);
      await use(author, 'logo');
      await go(publicationRoute, author);
      await click('Submit for review', author);
      await publicationState(author, 'submitted');
      await go(reviewRoute, reviewer);
      await click('Approve publication', reviewer);
      await publicationState(reviewer, 'approved');

      // Grant issuance/DNS has a separate real-provider browser qualification.
      await source.query(
        "UPDATE editorial_resource_states SET ownerIdentityId = ? WHERE resourceKind = 'app' AND resourceId = ?",
        ['DraftBrowserBob', id]
      );
      await source.query(
        'INSERT INTO application_ownership_grants (applicationId, tenantId, claimantIdentityId, claimId, grantedAt, revokedAt) VALUES (?, ?, ?, ?, ?, NULL)',
        [id, 'default', 'DraftBrowserBob', randomUUID(), Date.now()]
      );
      await go('/my/apps/owned/' + id, successor);
      await click('Save private draft', successor);
      await successor.waitForFunction(() =>
        new URLSearchParams(location.search).has('draftId')
      );
      await idle(successor);
      const editingId = new URL(successor.url()).searchParams.get('draftId');
      await upload(successor, 'logo', files.replacement);
      await use(successor, 'logo');
      const edited = await current(editingId, 'DraftBrowserBob');
      await click('Remove banner', successor);
      await text('Draft image saved.', successor);
      await idle(successor);
      const canonical = await json(
        'GET',
        'me/application-drafts/canonical/' + id,
        undefined,
        'DraftBrowserBob'
      );
      await json(
        'PUT',
        'apps/' + id,
        {
          name: 'Staff corrected media application',
          expectedRevision: canonical.sourcePublicationRevision,
        },
        'MediaBrowserModerator',
        ['editorial:moderator']
      );
      await click('Refresh canonical content', successor);
      await text('canonical application changed', successor);
      await successor.$eval('input[name="image-merge-banner"]', (input) =>
        input.closest('fieldset').querySelectorAll('input')[1].click()
      );
      await capture('media-merge-comparison', successor);
      await click('Merge with current revision', successor);
      await click('Confirm merged draft', successor);
      await text('Pending review was cancelled', successor);
      const merged = await current(editingId, 'DraftBrowserBob');
      assert.deepEqual(merged.images.logo, edited.images.logo);
      assert.deepEqual(merged.images.banner, saved.images.banner);
      assert.equal(
        merged.editing.sourcePublicationRevision,
        canonical.sourcePublicationRevision + 1
      );
      await image(successor, 'draft banner');
      await capture('media-merged', successor);

      const legacy = await create('browser-legacy-image-snapshot');
      await go('/my/apps/' + legacy + '/publication', author);
      await click('Submit for review', author);
      await publicationState(author, 'submitted');
      await source.query(
        'DELETE FROM application_submission_images WHERE draftId = ?',
        [legacy]
      );
      await go('/editorial/apps/' + legacy, reviewer);
      await text('no recorded image snapshot', reviewer);
      assert.equal(
        await reviewer.$eval(
          'application-publication-page',
          (host) =>
            [...host.querySelectorAll('button')].find(
              (button) => button.textContent.trim() === 'Approve publication'
            ).disabled
        ),
        true
      );
      await capture('media-legacy-review', reviewer);
      await go('/my/apps/' + legacy + '/publication', author);
      await click('Resubmit with current images', author);
      await publicationState(author, 'submitted');
      await author.waitForFunction(
        () =>
          !document
            .querySelector('application-publication-page')
            .textContent.includes('no recorded image snapshot')
      );
      await go('/editorial/apps/' + legacy, reviewer);
      await click('Approve publication', reviewer);
      await publicationState(reviewer, 'approved');

      const removed = await create('browser-removed-upload-draft');
      loseResponse(
        (route, method) =>
          route === '/api/me/application-images' && method === 'POST'
      );
      await select(author, 'Upload logo', files.logo);
      await text('Finish the pending image change', author);
      await idle(author);
      const removedState = await current(removed);
      await json('DELETE', 'me/application-drafts/' + removed, {
        expectedRevision: removedState.revision,
      });
      await author.reload({ waitUntil: 'networkidle0' });
      await click('Cancel pending upload', author);
      await text('no longer accessible', author);
      assert.equal(await storage(author), null);
      await capture('media-deleted-draft-recovery', author);

      await go('/apps/register?draftId=' + legacy, author);
      loseResponse(
        (route, method) => route.endsWith('/content') && method === 'PUT'
      );
      await select(author, 'Upload logo', files.logo);
      await text('Finish the pending image change', author);
      await idle(author);
      await author.evaluate(() => {
        localStorage.setItem('_i', 'draft-bob');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: '_i',
            newValue: 'draft-bob',
            storageArea: localStorage,
          })
        );
      });
      await text('not found', author);
      assert.equal(await storage(author), null);
      assert.equal(await author.$('application-image-preview img'), null);
      assert.equal(
        await author.$('input[aria-label="Original image for retry"]'),
        null
      );
      return [
        'real binary upload, authorized verified preview, separate attachment/removal and referenced cancellation refusal',
        'lost reservation/upload/attachment responses recover exact keys after reload; different file refused',
        'unsaved text preserved, independent stale revision conflict and retained upload recovery',
        'no-file cancellation across routes, deleted-draft recovery, outage recovery and account isolation',
        'review freezes image slots despite later private removal; wrong owner/reviewer denied',
        'approved public media survives API restart and withdrawal denies it during projection lag',
        'explicit per-slot canonical merge preserves private logo and restores canonical banner',
        'legacy unknown snapshots block approval and require author resubmission',
      ];
    },
  });
}
module.exports = { applicationMediaBrowser };
