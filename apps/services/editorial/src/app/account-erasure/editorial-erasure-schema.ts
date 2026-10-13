import type { QueryRunner } from 'typeorm';

export const EDITORIAL_AUTHOR_ERASURE = 'EditorialAuthorErasure1791840010000';

export async function editorialAuthorErasureApplied(runner: QueryRunner) {
  return (
    (await runner.hasTable('editorial_migrations')) &&
    (
      await runner.query(
        'SELECT name FROM editorial_migrations WHERE name=? LIMIT 1',
        [EDITORIAL_AUTHOR_ERASURE]
      )
    ).length > 0
  );
}
