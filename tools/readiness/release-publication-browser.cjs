const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const path = require('node:path');

async function releasePublicationBrowser(options) {
  const { root, source, policy, reader, projections, restart } = options;
  const load = (name) =>
    require(path.join(root, 'apps/services/editorial/src/app', name));
  const { EditorialCommands } = load('application/editorial-commands');
  const { MysqlEditorialWrites } = load(
    'infrastructure/mysql-editorial-writes'
  );
  const { ApplicationOwnership } = load(
    'application-ownership/application-ownership'
  );
  const { MysqlApplicationOwnership } = load(
    'application-ownership/mysql-application-ownership'
  );
  const { projectEditorialSnapshot } = load(
    'application/editorial-materialization'
  );
  const owner = {
    identityId: 'DraftBrowserAlice',
    tenantId: 'default',
    roles: [],
  };
  const staff = {
    identityId: 'OwnershipBrowserReviewer',
    tenantId: 'default',
    roles: ['editorial:ownership-reviewer'],
  };
  const editorial = new EditorialCommands(
    new MysqlEditorialWrites(source, 'default'),
    policy,
    { generate: randomUUID }
  );
  const application = await editorial.create(
    'app',
    {
      name: 'Browser release application',
      slug: 'browser-release-application',
      website: 'https://browser-release.example.test',
      description: 'Application for independent browser release qualification.',
    },
    {
      identityId: 'BrowserReleasePublisher',
      tenantId: 'default',
      roles: ['editorial:publisher'],
    },
    randomUUID()
  );
  const ownership = new ApplicationOwnership(
    new MysqlApplicationOwnership(source),
    { matches: async () => true },
    policy,
    {
      id: randomUUID,
      token: () => randomBytes(32).toString('hex'),
    }
  );
  const claim = await ownership.create(
    owner,
    {
      applicationId: application.id,
      evidenceUrl: 'https://browser-release.example.test/team',
      notes: 'I maintain this application and control its official website.',
    },
    randomUUID()
  );
  const verified = await ownership.change(
    owner,
    claim.id,
    'verify',
    { expectedRevision: claim.revision },
    randomUUID()
  );
  await ownership.change(
    staff,
    claim.id,
    'approve',
    { expectedRevision: verified.revision },
    randomUUID()
  );
  const project = async (id) =>
    projections.publish(
      projectEditorialSnapshot(await reader.read('release', id))
    );
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
        ...options.headers(actor, 'default', roles),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    const value = await response.json();
    assert(
      response.ok,
      `${method} ${route}: ${response.status} ${JSON.stringify(value)}`
    );
    return value;
  };
  const draft = (id) => json('GET', 'me/releases/' + id);
  const publication = (id) => json('GET', 'me/releases/' + id + '/publication');
  const fields = {
    version: '1.0+browser',
    title: 'First browser release',
    description: 'Release description from the owner.',
    channel: 'stable',
    type: 'major',
    releasedOn: '2026-01-01',
    changes: [{ type: 'feature', description: 'A complete usable workflow.' }],
  };
  const publicList = '/apps/browser-release-application/devlog';
  const newRoute = '/my/releases/new?applicationId=' + application.id;
  return require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    workflowOnly: true,
    releaseWorkflow: async ({
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
      const author = await session('draft-alice');
      const independent = await session('draft-alice');
      const reviewer = await session('draft-reviewer');
      const stranger = await session('draft-bob');
      const publicReader = await session('');
      const idle = (page) =>
        page.waitForFunction(
          () =>
            document
              .querySelector('app-release-workspace .application-workspace')
              ?.getAttribute('aria-busy') === 'false'
        );
      const link = async (label, page) => {
        await page.waitForFunction(
          (label) =>
            [
              ...document.querySelectorAll(
                'app-release-workspace a, app-release-devlog a'
              ),
            ].some((a) => a.textContent.trim() === label),
          {},
          label
        );
        await page.evaluate(
          (label) =>
            [
              ...document.querySelectorAll(
                'app-release-workspace a, app-release-devlog a'
              ),
            ]
              .find((a) => a.textContent.trim() === label)
              .click(),
          label
        );
      };
      const form = async (page, values) => {
        for (const key of ['version', 'title', 'description', 'releasedOn'])
          await fill('#release-' + key, values[key], page);
        await fill('#release-change-0', values.changes[0].description, page);
      };
      const confirm = async (action, page) => {
        await click(
          action === 'delete'
            ? 'Delete private draft'
            : action === 'withdraw'
            ? 'Withdraw release'
            : 'Merge chosen draft',
          page
        );
        await capture('confirm-' + action, page);
        await click('Confirm ' + action, page);
        await idle(page);
      };
      await go(publicList, publicReader);
      await text('No published release notes yet', publicReader);
      await capture('public-empty', publicReader);
      await go('/my/releases', author);
      await text('No release drafts yet', author);
      await capture('owner-empty', author);
      await go(newRoute, author);
      await text('Release notes for Browser release application', author);
      await form(author, fields);
      await capture('draft-create', author);
      loseResponse(
        (route, method) => route === '/api/me/releases' && method === 'POST'
      );
      await click('Save release draft', author);
      await text('Retry unconfirmed change', author);
      const createKey = commands.at(-1).key;
      await capture('create-uncertain', author);
      await link('My release notes', author);
      await text('Retry unconfirmed change', author);
      await click('Retry unconfirmed change', author);
      await text('Release draft saved to your account.', author);
      assert.equal(commands.at(-1).key, createKey);
      const [created] = await json('GET', 'me/releases');
      assert(created);
      const id = created.id;
      await go('/my/releases/' + id, independent);
      await idle(independent);
      assert.equal(
        await independent.$eval('#release-title', (input) => input.value),
        fields.title
      );
      await go('/my/releases/' + id, stranger);
      await text('not found', stranger);
      await capture('wrong-account', stranger);
      await go('/my/releases/' + id, author);
      await idle(author);
      await click('Submit saved notes for review', author);
      await text('Submitted for independent review.', author);
      await idle(author);
      await capture('submitted', author);
      await fill('#release-title', 'Private edit after submission', author);
      await click('Save release draft', author);
      await idle(author);
      await go('/editorial/releases/' + id, author);
      await text('does not allow this action', author);
      await capture('review-denied', author);
      await go('/editorial/releases', reviewer);
      await text('First browser release', reviewer);
      await capture('review-queue', reviewer);
      await go('/editorial/releases/' + id, reviewer);
      await text('Submitted snapshot: First browser release', reviewer);
      await text('Release notes for Browser release application', reviewer);
      assert(
        !(
          await reviewer.$eval('app-release-workspace', (el) => el.textContent)
        ).includes('Private edit after submission')
      );
      await fill(
        '#release-review-reason',
        'Please explain compatibility.',
        reviewer
      );
      loseResponse((route) => route.endsWith('/decision'));
      await click('Reject release', reviewer);
      await text('Retry unconfirmed change', reviewer);
      const rejectKey = commands.at(-1).key;
      await click('Retry unconfirmed change', reviewer);
      await text('Submission rejected.', reviewer);
      assert.equal(commands.at(-1).key, rejectKey);
      await go('/my/releases/' + id, author);
      await text('Please explain compatibility.', author);
      await capture('rejected', author);
      await click('Submit saved notes for review', author);
      await idle(author);
      await go('/editorial/releases/' + id, reviewer);
      await text('Private edit after submission', reviewer);
      await capture('review-frozen', reviewer);
      loseResponse((route) => route.endsWith('/decision'));
      await click('Approve release', reviewer);
      await text('Retry unconfirmed change', reviewer);
      const approveKey = commands.at(-1).key;
      await click('Retry unconfirmed change', reviewer);
      await text('Approved. The public devlog is updating.', reviewer);
      assert.equal(commands.at(-1).key, approveKey);
      await go(publicList, publicReader);
      await text('Release notes unavailable', publicReader);
      await capture('projection-lag', publicReader);
      await project(created.target.releaseId);
      await click('Retry release notes', publicReader);
      await text('Private edit after submission', publicReader);
      await capture('public-list', publicReader);
      const publicDetail =
        publicList + '/' + encodeURIComponent(fields.version);
      await go(publicDetail, publicReader);
      await text('A complete usable workflow.', publicReader);
      await capture('public-detail', publicReader);
      await restart();
      await go('/my/releases/' + id, independent);
      await idle(independent);
      await go('/my/releases/' + id, author);
      await idle(author);
      await fill('#release-title', 'Owner saved after publication', author);
      await click('Save release draft', author);
      await idle(author);
      await fill(
        '#release-description',
        'Keep this unsaved conflict text.',
        independent
      );
      await click('Save release draft', independent);
      await text('Reload and compare', independent);
      assert.equal(
        await independent.$eval('#release-description', (input) => input.value),
        'Keep this unsaved conflict text.'
      );
      await capture('private-conflict', independent);
      await go(publicDetail, publicReader);
      await text('Private edit after submission', publicReader);
      assert(
        !(
          await publicReader.$eval('app-release-devlog', (el) => el.textContent)
        ).includes('Owner saved after publication')
      );
      await go('/my/releases/' + id, author);
      await fill(
        '#release-description',
        'Retain this chosen description.',
        author
      );
      await click('Refresh canonical notes', author);
      await idle(author);
      assert.equal(
        await author.$eval('#release-description', (input) => input.value),
        'Retain this chosen description.'
      );
      await author.evaluate(
        () =>
          ([...document.querySelectorAll('details')].find((el) =>
            el.querySelector('summary').textContent.startsWith('Title:')
          ).open = true)
      );
      await click('Use canonical Title', author);
      await capture('merge-comparison', author);
      await confirm('rebase', author);
      assert.equal(
        (await draft(id)).description,
        'Retain this chosen description.'
      );
      assert.equal((await draft(id)).title, 'Private edit after submission');
      await click('Submit saved notes for review', author);
      await idle(author);
      await go('/editorial/releases/' + id, reviewer);
      await click('Approve release', reviewer);
      await idle(reviewer);
      await project(created.target.releaseId);
      await go(publicDetail, publicReader);
      await text('Retain this chosen description.', publicReader);
      await go(publicDetail, author);
      await link('Edit notes as verified owner', author);
      await text('Create private editing draft', author);
      await capture('canonical-open', author);
      await click('Create private editing draft', author);
      await text('Release draft saved to your account.', author);
      const drafts = await json('GET', 'me/releases');
      const replacement = drafts.find((item) => item.id !== id);
      assert(replacement);
      await go('/my/releases/' + id, author);
      await confirm('delete', author);
      await text('Private draft deleted.', author);
      await go(publicDetail, publicReader);
      await text('Retain this chosen description.', publicReader);
      await go('/my/releases/' + replacement.id, author);
      await confirm('withdraw', author);
      await text('no longer public', author);
      await go(publicDetail, publicReader);
      await text('Release notes not found', publicReader);
      await capture('withdrawn-detail', publicReader);
      await project(created.target.releaseId);
      await go('/my/releases/' + replacement.id, author);
      setOffline(true);
      await click('Save release draft', author);
      await text('Retry unconfirmed change', author);
      await capture('write-unavailable', author);
      setOffline(false);
      await click('Retry unconfirmed change', author);
      await text('Release draft saved to your account.', author);
      await go(publicList, publicReader);
      setOffline(true);
      await go(publicList, publicReader);
      await text('Release notes unavailable', publicReader);
      await capture('public-unavailable', publicReader);
      setOffline(false);
      await click('Retry release notes', publicReader);
      await text('No published release notes yet', publicReader);
      // Seed enough real reviewed releases to prove server pagination, independently of presentation fixtures.
      for (let index = 1; index <= 21; index++) {
        const created = await json('POST', 'me/releases', {
          applicationId: application.id,
          claimId: claim.id,
          fields: {
            ...fields,
            version: `page-${index}`,
            title: `Published page release ${index}`,
            releasedOn: index === 21 ? '2026-02-01' : '2026-01-01',
            channel: index === 20 ? 'prerelease' : 'stable',
          },
        });
        const state = await publication(created.id);
        await json('POST', `me/releases/${created.id}/submit`, {
          expectedRevision: state.revision,
          expectedPublicationRevision: state.publicationRevision,
        });
        const pending = await publication(created.id);
        const approved = await json(
          'POST',
          `editorial/release-reviews/${created.id}/decision`,
          {
            decision: 'approve',
            expectedRevision: pending.revision,
            expectedPublicationRevision: pending.publicationRevision,
            submittedRevision: pending.latestSubmission.submittedRevision,
            reason: '',
          },
          'DraftBrowserReviewer',
          ['editorial:reviewer']
        );
        await project(approved.releaseId);
      }
      await go(publicList, publicReader);
      await text('21 releases', publicReader);
      await capture('public-page-one', publicReader);
      assert.equal(
        await publicReader.$$eval(
          'app-release-devlog article',
          (items) => items.length
        ),
        20
      );
      await click('Next page', publicReader);
      await text('Page 2', publicReader);
      await capture('public-page-two', publicReader);
      assert.equal(
        await publicReader.$$eval(
          'app-release-devlog article',
          (items) => items.length
        ),
        1
      );
      await go(publicList + '?page=3', publicReader);
      await text('No releases on this page', publicReader);
      await capture('public-page-beyond', publicReader);
      await go(publicList + '?channel=stable', publicReader);
      await text('20 releases', publicReader);
      assert.equal(
        await publicReader.$$eval(
          'app-release-devlog article',
          (items) => items.length
        ),
        20
      );
      await capture('stable-channel', publicReader);
      await go(publicList + '?channel=prerelease', publicReader);
      await text('1 releases', publicReader);
      await text('Published page release 20', publicReader);
      await capture('prerelease-channel', publicReader);
      await go(publicList + '/page-21', publicReader);
      await text('Previous releases', publicReader);
      await publicReader.waitForFunction(
        () =>
          document.querySelectorAll('.release-history article').length === 20
      );
      await capture('previous-releases', publicReader);
      assert(
        !(
          await publicReader.$eval('.release-history', (el) => el.textContent)
        ).includes('Published page release 21')
      );
      await go(publicList + '/page-21?page=2', publicReader);
      await text('No previous releases on this page.', publicReader);
      await capture('previous-page-beyond', publicReader);
      await go(publicList + '/missing-version', publicReader);
      await text('Release notes not found', publicReader);
      await go(newRoute, stranger);
      await text('not found', stranger);
      await capture('unverified-owner', stranger);
      return [
        'domain proof fixture and independent ownership approval before private release authoring',
        'exact create command recovery across client navigation and separate-session persistence',
        'private edits leave immutable reviewer snapshots and public notes unchanged',
        'independent rejection/approval with lost response retries and explicit reasons',
        'projection lag, public list/detail, withdrawal tombstone and truthful outages',
        'API restart, private revision conflict, preserved unsaved fields and explicit canonical merge',
        'opening canonical notes in a separate draft, private deletion preserving public notes',
        'server-backed public pagination, out-of-range pages, wrong-account and unverified-owner denials',
      ];
    },
  });
}
module.exports = { releasePublicationBrowser };
