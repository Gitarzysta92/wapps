import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectAngularPackage } from './check-angular-packages.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'wapps-package-check-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const write = (name, content) =>
    writeFileSync(path.join(directory, name), content);
  write(
    'package.json',
    JSON.stringify({
      name: '@test/ui',
      module: 'entry.mjs',
      typings: 'index.d.ts',
    })
  );
  write('entry.mjs', "export { Widget } from './widget.mjs';");
  write(
    'widget.mjs',
    "import * as core from '@angular/core'; export class Widget {} Widget.definition = core.\u0275\u0275ngDeclareComponent({type: Widget});"
  );
  write('index.d.ts', "export { Widget } from './widget';");
  write('widget.d.ts', 'export declare class Widget {}');
  return { directory, write };
}

test('follows generated chunks and public declarations', (t) => {
  const { directory } = fixture(t);
  assert.deepEqual(inspectAngularPackage(directory, '@test/ui'), {
    name: '@test/ui',
    esmFiles: 2,
    declarationFiles: 2,
    angularDeclarations: 1,
  });
});

test('rejects CommonJS hidden behind an mjs extension', (t) => {
  const { directory, write } = fixture(t);
  write(
    'entry.mjs',
    'Object.defineProperty(exports, "__esModule", {value: true}); require("./index");'
  );
  assert.throws(
    () => inspectAngularPackage(directory, '@test/ui'),
    /not an ES module/
  );
  write('entry.mjs', 'export const value = require("./index");');
  assert.throws(
    () => inspectAngularPackage(directory, '@test/ui'),
    /CommonJS require/
  );
});

test('resolves declaration directory barrels', (t) => {
  const { directory, write } = fixture(t);
  mkdirSync(path.join(directory, 'barrel'));
  write('barrel/index.d.ts', "export { Widget } from '../widget';");
  write('index.d.ts', "export * from './barrel';");
  assert.equal(
    inspectAngularPackage(directory, '@test/ui').declarationFiles,
    3
  );
});

test('rejects missing lazy chunks and declaration re-exports', (t) => {
  const { directory, write } = fixture(t);
  write('entry.mjs', 'export const lazy = () => import("./missing.mjs");');
  assert.throws(() => inspectAngularPackage(directory, '@test/ui'), /ENOENT/);
  write('entry.mjs', "export { Widget } from './widget.mjs';");
  write('index.d.ts', "export * from './missing';");
  assert.throws(() => inspectAngularPackage(directory, '@test/ui'), /ENOENT/);
});

test('rejects missing Angular compilation and mismatched identity', (t) => {
  const { directory, write } = fixture(t);
  write('widget.mjs', 'export class Widget {}');
  assert.throws(
    () => inspectAngularPackage(directory, '@test/ui'),
    /No partial Angular/
  );
  assert.throws(
    () => inspectAngularPackage(directory, '@test/other'),
    /identity mismatch/
  );
});

test('does not accept a relative import escaping the package', (t) => {
  const { directory, write } = fixture(t);
  write('entry.mjs', "export * from '../other.mjs';");
  assert.throws(
    () => inspectAngularPackage(directory, '@test/ui'),
    /leaves package/
  );
});
