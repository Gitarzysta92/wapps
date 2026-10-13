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
