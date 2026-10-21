import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { auditArchitecture, dependencyRules } from './check-architecture.mjs';

test('detects forbidden dependency directions while allowing composition and pure ports', () => {
  const cases = [
    [
      'libs/domains/customer/src/port.ts',
      '@angular/core',
      '@angular/core',
      ['ARCH001'],
    ],
    [
      'libs/ui/card/src/card.ts',
      'apps/portals/shared/boundary/src/index.ts',
      '@boundary',
      ['ARCH002'],
    ],
    [
      'sdk/features/discussion/core/src/service.ts',
      '@nestjs/common',
      '@nestjs/common',
      ['ARCH001'],
    ],
    [
      'sdk/features/identity/core/src/identity.ts',
      'sdk/kernel/ontology/identity/src/index.ts',
      '@sdk/kernel/ontology/identity',
      [],
    ],
    [
      'sdk/kernel/standard/src/value.ts',
      'sdk/extras/mysql/src/index.ts',
      '@mysql',
      ['ARCH003'],
    ],
    [
      'apps/portals/shared/features/search/src/index.ts',
      'apps/portals/aggregator/application/src/routes.ts',
      '@routes',
      ['ARCH004'],
    ],
    [
      'apps/portals/shared/features/search/src/application/search.ts',
      'apps/portals/shared/features/search/src/infrastructure/api.ts',
      '../infrastructure/api',
      ['ARCH005'],
    ],
    [
      'apps/portals/aggregator/application/src/pages/search/page.ts',
      'apps/portals/shared/features/search/src/infrastructure/api.ts',
      '@search',
      ['ARCH006'],
    ],
    [
      'apps/portals/aggregator/application/src/root.ts',
      'apps/portals/shared/features/search/src/infrastructure/api.ts',
      '@search',
      [],
    ],
    [
      'apps/portals/shared/features/search/src/application/search.ts',
      'libs/domains/catalog/src/port.ts',
      '@catalog',
      [],
    ],
    [
      'libs/domains/catalog/src/port.ts',
      'sdk/kernel/standard/src/index.ts',
      '@foundation/standard',
      [],
    ],
  ];
  for (const [source, target, specifier, expected] of cases) {
    assert.deepEqual(
      dependencyRules(source, target, specifier),
      expected,
      source
    );
  }
});

test('enforces independent authentication and Identity composition roots', () => {
  const auth =
    'sdk/features/identity/applications/authenticator/service/src/app.module.ts';
  const identity =
    'sdk/features/identity/applications/management/service/src/app/app.module.ts';
  assert.deepEqual(
    dependencyRules(
      auth,
      'libs/adapters/account-mysql/src/index.ts',
      '@wapps/account-mysql'
    ),
    ['ARCH011']
  );
  assert.deepEqual(
    dependencyRules(
      identity,
      'sdk/features/identity/packages/infrastructure/local/src/index.ts',
      '@sdk/extras/identity-local'
    ),
    ['ARCH011']
  );
  assert.deepEqual(
    dependencyRules(
      identity,
      'sdk/features/identity/packages/infrastructure/firebase/src/index.ts',
      '@sdk/extras/identity-firebase'
    ),
    ['ARCH011']
  );
  assert.deepEqual(
    dependencyRules(identity, 'firebase-admin', 'firebase-admin'),
    ['ARCH011']
  );
  assert.deepEqual(
    dependencyRules(
      identity,
      'sdk/features/identity/libs/authentication/src/index.ts',
      '@sdk/features/identity/libs/authentication'
    ),
    []
  );
});

test('resolves alias and relative imports, re-exports, dynamic imports, and renamed barrel symbols', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'wapps-architecture-'));
  const write = (name, content) => {
    const filename = path.join(root, name);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, content);
  };
  try {
    write(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          moduleResolution: 'node',
          paths: {
            '@feature': ['apps/portals/shared/features/search/src/index.ts'],
            '@page': [
              'apps/portals/aggregator/application/src/pages/search/page.ts',
            ],
          },
        },
      })
    );
    write(
      'apps/portals/shared/features/search/src/infrastructure/api.ts',
      'export class SearchApi {}'
    );
    write(
      'apps/portals/shared/features/search/src/index.ts',
      "export { SearchApi as Adapter } from './infrastructure/api';"
    );
    write(
      'apps/portals/aggregator/application/src/pages/search/page.ts',
      "import { Adapter as Renamed } from '@feature'; export const adapter = Renamed;"
    );
    write('libs/ui/card/src/index.ts', "export * from '@page';");
    write(
      'apps/portals/shared/features/search/src/application/service.ts',
      "export const api = import('../infrastructure/api');"
    );
    write(
      'libs/domains/catalog/src/port.ts',
      "// import { InjectionToken } from '@angular/core';\nexport const message = \"import('@angular/core')\";"
    );
    write(
      'libs/domains/catalog/src/port.spec.ts',
      "import { TestBed } from '@angular/core/testing';"
    );
    write(
      'libs/domains/catalog/src/test-setup.ts',
      "import { TestBed } from '@angular/core/testing';"
    );
    write(
      'libs/domains/catalog/src/__tests__/helper.ts',
      "import { TestBed } from '@angular/core/testing';"
    );
    const result = auditArchitecture(root);
    assert.equal(result.filesScanned, 6);
    assert.deepEqual(result.counts, {
      ARCH001: 0,
      ARCH002: 1,
      ARCH003: 0,
      ARCH004: 0,
      ARCH005: 1,
      ARCH006: 1,
      ARCH007: 0,
      ARCH008: 0,
      ARCH009: 0,
      ARCH010: 0,
      ARCH011: 0,
    });
    const pageViolation = result.violations.find(
      (finding) => finding.rule === 'ARCH006'
    );
    assert.equal(
      pageViolation.target,
      'apps/portals/shared/features/search/src/infrastructure/api.ts'
    );
    assert.equal(pageViolation.line, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails explicitly for an invalid or empty workspace', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'wapps-architecture-empty-'));
  try {
    assert.throws(() => auditArchitecture(root));
    writeFileSync(path.join(root, 'tsconfig.base.json'), '{}');
    assert.throws(() => auditArchitecture(root), /No .* source files/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Discussion cannot depend on its Wapps consumer or define product target types', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'wapps-discussion-boundary-'));
  try {
    writeFileSync(path.join(root, 'tsconfig.base.json'), '{}');
    const dir = path.join(root, 'sdk/features/discussion/core/src');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'key.ts'),
      'export type Kind = "article" | "application"; export interface DiscussionTarget { subjectKind: Kind; }'
    );
    const result = auditArchitecture(root);
    assert.equal(result.counts.ARCH008, 4);
    assert.deepEqual(
      dependencyRules(
        'sdk/features/discussion/libs/management/src/usecase.ts',
        'libs/domains/community/src/index.ts',
        '@domains/community'
      ),
      ['ARCH007']
    );
    assert.deepEqual(
      dependencyRules(
        'apps/services/community/src/app/module.ts',
        'sdk/features/discussion/libs/management/src/index.ts',
        '@sdk/features/discussion/libs/management'
      ),
      []
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Identity and Review engines reject consumer contracts, registries and target-specific fields', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'wapps-consumer-boundary-'));
  try {
    writeFileSync(path.join(root, 'tsconfig.base.json'), '{}');
    for (const source of [
      'sdk/features/identity/libs/management/src/usecase.ts',
      'sdk/features/review/core/src/review.ts',
      'sdk/features/review/libs/management/src/reviews.ts',
      'sdk/features/review/packages/infrastructure/http/src/reviews.controller.ts',
    ]) {
      mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
      writeFileSync(
        path.join(root, source),
        'export const ACCOUNT_EXPORT_SOURCES = ["editorial"]; export interface Target { applicationId: string; }'
      );
      for (const target of [
        'libs/domains/community/src/index.ts',
        'libs/usecases/account/src/index.ts',
        'libs/adapters/account-mysql/src/index.ts',
        'apps/services/community/src/index.ts',
      ]) {
        assert.ok(
          dependencyRules(source, target, '@consumer').includes('ARCH009')
        );
        assert.ok(
          dependencyRules(
            'sdk/kernel/standard/src/key.ts',
            target,
            '@consumer'
          ).includes('ARCH003')
        );
        assert.ok(
          dependencyRules(
            'sdk/features/discussion/core/src/key.ts',
            target,
            '@consumer'
          ).includes('ARCH007')
        );
      }
    }
    assert.equal(auditArchitecture(root).counts.ARCH010, 12);
    assert.deepEqual(
      dependencyRules(
        'libs/usecases/account/src/application/notifications.ts',
        'sdk/features/identity/libs/management/src/index.ts',
        '@sdk/features/identity/libs/management'
      ),
      []
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
