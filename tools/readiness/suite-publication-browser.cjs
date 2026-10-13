const assert = require('node:assert/strict');

async function suitePublicationBrowser({
  session,
  go,
  text,
  click,
  fill,
  capture,
  projectSuite,
  source,
  restart,
  commands,
  loseResponse,
  metadataOutage,
}) {
  const owner = await session('suite-bob');
  const reviewer = await session('suite-reviewer');
  const reader = await session('');
  await go('/suites/create', owner);
  await text('Browser Suite Beta', owner);
  await fill('#suite-title', 'Published research suite', owner);
  await fill(
    '#suite-description',
    'Tools selected for a reviewed public collection.',
    owner
  );
  await owner.click('button[aria-label="Add Browser Suite Beta"]');
  await click('Save suite', owner);
  await text('Manage publication', owner);
  const id = new URL(owner.url()).pathname.split('/').at(-1);
  await owner.click('a[href$="/publication"]');
  await text('Submit saved draft', owner);
  await capture('publication-owner', owner);
  loseResponse();
  await click('Submit saved draft', owner);
  await text('Retry unconfirmed change', owner);
  const submitKey = commands.at(-1).key;
  await click('Retry unconfirmed change', owner);
  await text('Submitted for review.', owner);
  assert.equal(commands.at(-1).key, submitKey);
  assert.equal(
    Number(
      (
        await source.query('SELECT revision FROM private_suites WHERE id = ?', [
          id,
        ])
      )[0].revision
    ),
    2
  );
  await go('/suites/' + id, reader);
  await text('Suite not found', reader);
  await go('/editorial/suites', reviewer);
  await text('Published research suite', reviewer);
  await reviewer.click(`a[href="/editorial/suites/${id}"]`);
  await text('Approve submission', reviewer);
  await capture('publication-review', reviewer);
  await go('/my/suites/' + id, owner);
  await click('Edit suite', owner);
  await fill('#suite-title', 'Unreviewed replacement title', owner);
  await click('Save suite', owner);
  await text('Suite saved.', owner);
  await click('Approve submission', reviewer);
  await text('This suite or submission changed', reviewer);
  await click('Reload suite publication', reviewer);
  await text('Published research suite', reviewer);
  assert.equal(
    await reviewer.evaluate(() =>
      document
        .querySelector('suite-publication-page')
        .textContent.includes('Unreviewed replacement title')
    ),
    false
  );
  await click('Approve submission', reviewer);
  await text('Approved. Public content will appear', reviewer);
  await go('/suites/' + id, reader);
  await text('unavailable or updating', reader);
  await capture('publication-pending', reader);
  await projectSuite(id);
  await click('Reload suite publication', reader);
  await text('Published research suite', reader);
  await text('Browser Suite Beta', reader);
  await capture('publication-detail', reader);
  metadataOutage(true);
  await reader.reload({ waitUntil: 'networkidle0' });
  await text('unavailable or updating', reader);
  metadataOutage(false);
  await click('Reload suite publication', reader);
  await text('Published research suite', reader);
  await go('/suites?q=Published', reader);
  await text('Published research suite', reader);
  await capture('publication-list', reader);
  await restart();
  await go(`/my/suites/${id}/publication`, owner);
  await text('Unreviewed replacement title', owner);
  await click('Submit saved draft', owner);
  await text('Submitted for review.', owner);
  await go('/editorial/suites/' + id, reviewer);
  await text('Unreviewed replacement title', reviewer);
  await fill(
    '#suite-review-reason',
    'Please describe the new selection.',
    reviewer
  );
  await click('Reject submission', reviewer);
  await text('Submission rejected.', reviewer);
  await go(`/my/suites/${id}/publication`, owner);
  await text('Please describe the new selection.', owner);
  await go('/suites/' + id, reader);
  await text('Published research suite', reader);
  await click('Withdraw suite', owner);
  await click('Confirm withdrawal', owner);
  await text('Withdrawn. This suite is no longer public.', owner);
  await go('/suites/' + id, reader);
  await text('Suite not found', reader);
  await capture('publication-withdrawn', reader);
  console.log(
    'PASS: owner submission, reviewer approval/rejection, independent public reader, stale review, lost-response retry, immutable revision, restart and withdrawal browser journey'
  );
}
module.exports = { suitePublicationBrowser };
